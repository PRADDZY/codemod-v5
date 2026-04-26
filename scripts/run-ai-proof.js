#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import fg from "fast-glob";

const DEFAULT_OUTPUT = "ai-proof-summary.json";

const SOLIDITY_GLOB = ["**/*.sol"];
const SOLIDITY_EXCLUDE = [
  "**/node_modules/**",
  "**/lib/**",
  "**/out/**",
  "**/artifacts/**",
  "**/cache/**",
];

export function parseAiProofArgs(argv) {
  const options = {
    target: null,
    workflowPath: process.cwd(),
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--target") {
      options.target = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (current === "--workflow-path") {
      options.workflowPath = argv[index + 1] ?? options.workflowPath;
      index += 1;
      continue;
    }
    if (current === "--output") {
      options.output = argv[index + 1] ?? DEFAULT_OUTPUT;
      index += 1;
      continue;
    }
    if (current === "-h" || current === "--help") {
      return { ...options, help: true };
    }
    throw new Error(`Unknown option: ${current}`);
  }

  if (!options.target) {
    throw new Error("Missing --target <path>.");
  }

  return { ...options, help: false };
}

export function countTodoMarkersInSource(source) {
  const todoRegex = /OZ-V5-TODO\[([^\]]+)\]/g;
  const categories = {};
  let total = 0;
  let match = todoRegex.exec(source);
  while (match) {
    total += 1;
    const category = match[1];
    categories[category] = (categories[category] ?? 0) + 1;
    match = todoRegex.exec(source);
  }
  return { total, categories };
}

function mergeCounts(left, right) {
  const merged = { ...left };
  for (const [category, count] of Object.entries(right)) {
    merged[category] = (merged[category] ?? 0) + count;
  }
  return merged;
}

export async function collectTodoCounts(targetPath) {
  const files = await fg(SOLIDITY_GLOB, {
    cwd: targetPath,
    ignore: SOLIDITY_EXCLUDE,
    dot: false,
    onlyFiles: true,
  });

  let total = 0;
  let categories = {};
  for (const file of files) {
    const fullPath = path.join(targetPath, file);
    const source = await fs.readFile(fullPath, "utf8");
    const counts = countTodoMarkersInSource(source);
    total += counts.total;
    categories = mergeCounts(categories, counts.categories);
  }

  return { total, categories, scanned_files: files.length };
}

function runWorkflowAiStep({ workflowPath, targetPath }) {
  const command = `npx codemod@latest workflow run -w "${workflowPath}" -t "${targetPath}" --no-interactive --allow-dirty --allow-fs --param aiReview=true`;
  const result = spawnSync(command, {
    encoding: "utf8",
    shell: true,
    env: process.env,
  });

  const errorText = result.error
    ? `\nspawn_error=${result.error.message ?? String(result.error)}`
    : "";

  return {
    command,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${errorText}`,
  };
}

function diffCategoryCounts(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diff = {};
  for (const key of keys) {
    diff[key] = (after[key] ?? 0) - (before[key] ?? 0);
  }
  return diff;
}

function buildUsageText() {
  return [
    "Usage:",
    "  node ./scripts/run-ai-proof.js --target <repoPath> [--workflow-path <workflowRoot>] [--output <file>]",
    "",
    "Example:",
    "  node ./scripts/run-ai-proof.js --target ./.codemod-eval/openzeppelin-contracts-upgradeable --workflow-path . --output ./.codemod-eval/ai-proof-summary.json",
  ].join("\n");
}

async function main() {
  const options = parseAiProofArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${buildUsageText()}\n`);
    return;
  }

  const targetPath = path.resolve(options.target);
  const workflowPath = path.resolve(options.workflowPath);
  const outputPath = path.resolve(options.output);

  const before = await collectTodoCounts(targetPath);
  const workflow = runWorkflowAiStep({ workflowPath, targetPath });
  const after = await collectTodoCounts(targetPath);

  const summary = {
    target_path: targetPath,
    workflow_path: workflowPath,
    generated_at: new Date().toISOString(),
    before_todos: before,
    after_todos: after,
    todo_delta: {
      total: after.total - before.total,
      categories: diffCategoryCounts(before.categories, after.categories),
    },
    workflow,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");
  process.stdout.write(`Wrote AI proof summary: ${outputPath}\n`);

  if (workflow.status !== 0) {
    process.exitCode = workflow.status;
  }
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exit(1);
  });
}
