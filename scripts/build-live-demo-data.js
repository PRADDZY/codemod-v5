#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_VERDICT_SUMMARY =
  "heavy-matrix-eval-slim/verdict-summary.json";
const DEFAULT_METRICS = "docs/submission/metrics.json";
const DEFAULT_EVIDENCE_MANIFEST = "docs/submission/evidence_manifest.json";
const DEFAULT_OUTPUT = "live-demo/public/data/scenarios.json";

const DIFF_SAMPLES = [
  {
    label: "ReentrancyGuard import move",
    before: 'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";',
    after: 'import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";',
  },
  {
    label: "Pausable import move",
    before: 'import "@openzeppelin/contracts/security/Pausable.sol";',
    after: 'import "@openzeppelin/contracts/utils/Pausable.sol";',
  },
  {
    label: "Upgradeable symbol rewrite",
    before:
      'import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";',
    after: 'import "@openzeppelin/contracts/token/ERC20/IERC20.sol";',
  },
];

function parseArgs(argv) {
  const options = {
    verdictSummary: DEFAULT_VERDICT_SUMMARY,
    metrics: DEFAULT_METRICS,
    evidenceManifest: DEFAULT_EVIDENCE_MANIFEST,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--verdict-summary") {
      options.verdictSummary = argv[index + 1] ?? DEFAULT_VERDICT_SUMMARY;
      index += 1;
      continue;
    }
    if (current === "--metrics") {
      options.metrics = argv[index + 1] ?? DEFAULT_METRICS;
      index += 1;
      continue;
    }
    if (current === "--evidence-manifest") {
      options.evidenceManifest = argv[index + 1] ?? DEFAULT_EVIDENCE_MANIFEST;
      index += 1;
      continue;
    }
    if (current === "--output") {
      options.output = argv[index + 1] ?? DEFAULT_OUTPUT;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${current}`);
  }

  return options;
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

function toPortablePath(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function toRepoRelative(inputPath) {
  const relative = path.relative(process.cwd(), path.resolve(inputPath));
  return toPortablePath(relative || ".");
}

function excerpt(raw, maxLines = 22) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return "";
  }
  return raw
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(0, maxLines)
    .join("\n");
}

export function extractTodoCategories(codemodStdout) {
  if (typeof codemodStdout !== "string") {
    return [];
  }
  const matches = [...codemodStdout.matchAll(/category=([a-z0-9_]+):\s*(\d+)/gi)];
  return matches.map((match) => ({
    category: match[1],
    count: Number(match[2]),
  }));
}

export function summarizeScenario({
  verdictTarget,
  evaluationSummary,
  evidenceRunUrl,
}) {
  const attempts = Array.isArray(evaluationSummary?.attempts)
    ? evaluationSummary.attempts
    : [];
  const selectedIndex =
    typeof evaluationSummary?.selected_attempt_index === "number"
      ? evaluationSummary.selected_attempt_index
      : 0;
  const selected = attempts[selectedIndex] ?? {};
  const codemod = selected?.codemod ?? {};
  const baselineCompile = selected?.baseline?.compile ?? {};
  const postCompile = selected?.post_codemod?.compile ?? {};
  const baselineTest = selected?.baseline?.test ?? {};
  const postTest = selected?.post_codemod?.test ?? {};

  return {
    id: verdictTarget.repo,
    name: verdictTarget.repo,
    repo_url: evaluationSummary?.repo_url ?? null,
    ref: evaluationSummary?.ref ?? null,
    verdict: verdictTarget.verdict ?? evaluationSummary?.verdict ?? "n/a",
    reason: verdictTarget.reason ?? evaluationSummary?.reason ?? null,
    selected_tier_mb:
      verdictTarget.selected_tier_mb ?? evaluationSummary?.selected_tier_mb ?? null,
    checks: {
      baseline_compile: verdictTarget.baseline_compile ?? null,
      baseline_test: verdictTarget.baseline_test ?? null,
      post_compile: verdictTarget.post_compile ?? null,
      post_test: verdictTarget.post_test ?? null,
      regression_any: selected?.regression?.any ?? null,
    },
    timings_ms: {
      evaluation_total: verdictTarget.evaluation_duration_ms ?? null,
      codemod: codemod?.duration_ms ?? null,
      baseline_compile: baselineCompile?.duration_ms ?? null,
      baseline_test: baselineTest?.duration_ms ?? null,
      post_compile: postCompile?.duration_ms ?? null,
      post_test: postTest?.duration_ms ?? null,
    },
    todo_markers: {
      total: Number(codemod?.stdout?.match(/todo_markers:\s*\n\s*(\d+)/i)?.[1] ?? 0),
      categories: extractTodoCategories(codemod?.stdout),
    },
    logs: {
      codemod_stdout_excerpt: excerpt(codemod?.stdout, 26),
      baseline_compile_excerpt: excerpt(baselineCompile?.stdout, 18),
      post_compile_excerpt: excerpt(postCompile?.stdout, 18),
      baseline_test_excerpt: excerpt(baselineTest?.stdout, 14),
      post_test_excerpt: excerpt(postTest?.stdout, 14),
    },
    diff_samples: DIFF_SAMPLES,
    run_commands: [
      "npm ci",
      "npm test",
      "npm run evaluate:matrix -- --mode full --workdir .codemod-eval-final --memory-tiers 4096,6144,8192,12288",
      "npm run evidence:submission:final",
    ],
    evidence_links: {
      summary_path: `heavy-matrix-eval-slim/${verdictTarget.repo}/evaluation-summary.json`,
      verdict_summary_path: "heavy-matrix-eval-slim/verdict-summary.json",
      workflow_run_url: evidenceRunUrl ?? null,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const verdictSummary = await readJson(path.resolve(options.verdictSummary));
  const metrics = await readJson(path.resolve(options.metrics));
  const evidenceManifest = await readJson(path.resolve(options.evidenceManifest));

  const targets = Array.isArray(verdictSummary?.targets) ? verdictSummary.targets : [];
  const workflowRunUrl =
    evidenceManifest?.workflow_evidence?.heavy_matrix_eval?.run_url ?? null;

  const scenarios = [];
  for (const target of targets) {
    if (!target?.repo) {
      continue;
    }
    const summaryPath = path.resolve(
      `heavy-matrix-eval-slim/${target.repo}/evaluation-summary.json`,
    );
    const evaluationSummary = await readJson(summaryPath);
    scenarios.push(
      summarizeScenario({
        verdictTarget: target,
        evaluationSummary,
        evidenceRunUrl: workflowRunUrl,
      }),
    );
  }

  const outputData = {
    generated_at: new Date().toISOString(),
    title: "OpenZeppelin v5 Safe Imports Live Replay",
    description:
      "Interactive replay of verified codemod runs. This demo serves precomputed evidence and does not execute arbitrary repositories at runtime.",
    links: {
      github_repo: metrics?.links?.github_repo ?? null,
      codemod_registry: metrics?.links?.codemod_registry ?? null,
      package_name: metrics?.links?.package_name ?? null,
      demo_video_url: metrics?.links?.demo_video_url ?? null,
      live_demo_url: metrics?.links?.live_demo_url ?? null,
      case_study_url: metrics?.links?.case_study_url ?? null,
    },
    summary: {
      completion_percent: metrics?.hackathon_completion_percent ?? null,
      ai_workflow_status: metrics?.ai_proof?.workflow_status ?? null,
      todo_before: metrics?.ai_proof?.todo_before ?? null,
      todo_after: metrics?.ai_proof?.todo_after ?? null,
      scenario_count: scenarios.length,
    },
    scenarios,
  };

  const outputPath = path.resolve(options.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), "utf8");

  process.stdout.write(`Wrote live demo data: ${toRepoRelative(outputPath)}\n`);
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
