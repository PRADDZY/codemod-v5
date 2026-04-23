#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseMemoryTiers, repoNameFromUrl } from "./evaluate-repo.js";

const DEFAULT_WORKDIR = ".codemod-eval-final";
const DEFAULT_MEMORY_TIERS = [4096, 6144, 8192, 12288];
const VALID_MODES = new Set(["full", "mixed", "smoke"]);

const TARGETS = [
  {
    name: "foundry-defi-stablecoin-cu",
    repoUrl: "https://github.com/Cyfrin/foundry-defi-stablecoin-cu.git",
    ref: "75c9add34c3e987812d96c93930fc821f4f9f9fb",
    compileWrapper: "foundry_compile.sh",
    testWrapper: "foundry_test.sh",
  },
  {
    name: "openzeppelin-contracts",
    repoUrl: "https://github.com/OpenZeppelin/openzeppelin-contracts.git",
    ref: "dc44c9f1a4c3b10af99492eed84f83ed244203f6",
    compileWrapper: "oz_compile.sh",
    testWrapper: "oz_test.sh",
  },
  {
    name: "openzeppelin-contracts-upgradeable",
    repoUrl: "https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable.git",
    ref: "2d081f24cac1a867f6f73d512f2022e1fa987854",
    compileWrapper: "oz_compile.sh",
    testWrapper: "oz_test.sh",
  },
];

const WRAPPER_SCRIPTS = {
  "foundry_compile.sh": [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "git submodule update --init --recursive",
    "forge build",
    "",
  ].join("\n"),
  "foundry_test.sh": [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "forge test",
    "",
  ].join("\n"),
  "oz_compile.sh": [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "npm install",
    "npm run compile",
    "",
  ].join("\n"),
  "oz_test.sh": [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "npm test",
    "",
  ].join("\n"),
};

function runCommand(command, args, { cwd, env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
  });
  return {
    command: [command, ...args].join(" "),
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function safeStatus(doc, phase, check) {
  const phaseNode = doc?.[phase];
  if (!phaseNode) {
    return null;
  }
  const checkNode = phaseNode[check];
  if (!checkNode) {
    return null;
  }
  return checkNode.status ?? null;
}

export function shouldRunTargetTests(mode, targetName) {
  if (mode === "full") {
    return true;
  }
  if (mode === "mixed") {
    return targetName === "foundry-defi-stablecoin-cu";
  }
  return false;
}

export function summarizeEvaluationDoc({
  targetName,
  evaluationExitCode,
  doc,
}) {
  if (!doc) {
    return {
      repo: targetName,
      summary_found: false,
      verdict: null,
      reason: "Missing evaluation-summary.json",
      selected_tier_mb: null,
      baseline_compile: null,
      baseline_test: null,
      post_compile: null,
      post_test: null,
      evaluation_exit_code: evaluationExitCode,
    };
  }

  return {
    repo: targetName,
    summary_found: true,
    verdict: doc.verdict ?? null,
    reason: doc.reason ?? null,
    selected_tier_mb: doc.selected_tier_mb ?? null,
    baseline_compile: safeStatus(doc, "baseline", "compile"),
    baseline_test: safeStatus(doc, "baseline", "test"),
    post_compile: safeStatus(doc, "post_codemod", "compile"),
    post_test: safeStatus(doc, "post_codemod", "test"),
    evaluation_exit_code: evaluationExitCode,
  };
}

export function parseMatrixArgs(argv) {
  const options = {
    mode: "full",
    workdir: DEFAULT_WORKDIR,
    memoryTiers: [...DEFAULT_MEMORY_TIERS],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "-h" || current === "--help") {
      options.help = true;
      continue;
    }
    if (current === "--mode") {
      options.mode = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (current === "--workdir") {
      options.workdir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (current === "--memory-tiers") {
      options.memoryTiers = parseMemoryTiers(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${current}`);
  }

  if (!VALID_MODES.has(options.mode)) {
    throw new Error(
      `Invalid --mode value: ${options.mode}. Supported values: full, mixed, smoke.`,
    );
  }

  if (!options.workdir) {
    throw new Error("--workdir cannot be empty.");
  }

  return options;
}

function buildUsageText() {
  return [
    "Usage:",
    "  node ./scripts/full-matrix-evaluate.js [--mode full|mixed|smoke] [--workdir <dir>] [--memory-tiers <csv>]",
    "",
    "Examples:",
    "  node ./scripts/full-matrix-evaluate.js --mode full --memory-tiers 4096,6144,8192,12288",
    "  node ./scripts/full-matrix-evaluate.js --mode smoke --workdir .codemod-eval-smoke",
    "",
    "Environment:",
    "  CODEMOD_API_KEY must be set.",
  ].join("\n");
}

async function writeWrapperScripts(opscriptsDir) {
  await fs.mkdir(opscriptsDir, { recursive: true });
  await Promise.all(
    Object.entries(WRAPPER_SCRIPTS).map(async ([name, body]) => {
      const target = path.join(opscriptsDir, name);
      await fs.writeFile(target, body, "utf8");
      await fs.chmod(target, 0o755);
    }),
  );
}

async function readJsonIfExists(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function createLogText({ command, exitCode, stdout, stderr }) {
  return [
    `COMMAND: ${command}`,
    `EXIT_CODE: ${exitCode}`,
    "",
    "--- STDOUT ---",
    stdout,
    "",
    "--- STDERR ---",
    stderr,
    "",
  ].join("\n");
}

async function createArtifact(workdir, targetPaths) {
  const artifactPath = path.join(workdir, "runs-evidence.tar.gz");
  const archiveInputs = ["verdict-summary.json", "logs", ...targetPaths];
  const tarResult = runCommand("tar", ["-czf", artifactPath, "-C", workdir, ...archiveInputs], {
    cwd: workdir,
    env: process.env,
  });

  if (tarResult.status !== 0) {
    return {
      created: false,
      artifactPath,
      error: tarResult.stderr || tarResult.stdout || "tar command failed",
    };
  }

  return {
    created: true,
    artifactPath,
    error: null,
  };
}

async function main() {
  const options = parseMatrixArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${buildUsageText()}\n`);
    return;
  }

  if (!process.env.CODEMOD_API_KEY) {
    throw new Error("Missing CODEMOD_API_KEY environment variable.");
  }

  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const evaluateScriptPath = path.join(packageRoot, "scripts", "evaluate-repo.js");
  const workdir = path.resolve(options.workdir);
  const logsDir = path.join(workdir, "logs");
  const opscriptsDir = path.join(workdir, "op-scripts");

  await fs.mkdir(workdir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  await writeWrapperScripts(opscriptsDir);

  const rows = [];
  const summaryPaths = [];

  for (const target of TARGETS) {
    const compileWrapper = path.join(opscriptsDir, target.compileWrapper);
    const testWrapper = path.join(opscriptsDir, target.testWrapper);

    const args = [
      evaluateScriptPath,
      "--repo-url",
      target.repoUrl,
      "--ref",
      target.ref,
      "--workdir",
      workdir,
      "--compile",
      compileWrapper,
      "--memory-tiers",
      options.memoryTiers.join(","),
    ];

    if (shouldRunTargetTests(options.mode, target.name)) {
      args.push("--test", testWrapper);
    }

    const evalRun = runCommand("node", args, {
      cwd: packageRoot,
      env: process.env,
    });

    const logPath = path.join(logsDir, `${target.name}.log`);
    await fs.writeFile(
      logPath,
      createLogText({
        command: evalRun.command,
        exitCode: evalRun.status,
        stdout: evalRun.stdout,
        stderr: evalRun.stderr,
      }),
      "utf8",
    );

    const targetSummaryPath = path.join(
      workdir,
      repoNameFromUrl(target.repoUrl),
      "evaluation-summary.json",
    );
    const targetSummary = await readJsonIfExists(targetSummaryPath);
    rows.push(
      summarizeEvaluationDoc({
        targetName: target.name,
        evaluationExitCode: evalRun.status,
        doc: targetSummary,
      }),
    );

    if (targetSummary) {
      summaryPaths.push(path.relative(workdir, targetSummaryPath));
    }
  }

  const verdictSummary = {
    mode: options.mode,
    memory_tiers_mb: options.memoryTiers,
    generated_at: new Date().toISOString(),
    targets: rows,
  };

  const verdictSummaryPath = path.join(workdir, "verdict-summary.json");
  await fs.writeFile(verdictSummaryPath, JSON.stringify(verdictSummary, null, 2), "utf8");

  const artifact = await createArtifact(workdir, summaryPaths);

  process.stdout.write(`Wrote verdict summary: ${verdictSummaryPath}\n`);
  if (artifact.created) {
    process.stdout.write(`Created artifact: ${artifact.artifactPath}\n`);
  } else {
    process.stderr.write(`Artifact creation failed: ${artifact.error}\n`);
  }

  if (rows.some((row) => row.verdict === "regression")) {
    process.exitCode = 3;
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
