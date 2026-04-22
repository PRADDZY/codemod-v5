#!/usr/bin/env node
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";

function runShell(command, cwd, envOverrides = {}) {
  const result = spawnSync(command, {
    cwd,
    encoding: "utf8",
    shell: true,
    env: {
      ...process.env,
      ...envOverrides,
    },
  });
  return {
    command,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function shellQuote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function repoNameFromUrl(repoUrl) {
  const normalized = repoUrl.replace(/\/+$/, "").replace(/\.git$/, "");
  const chunks = normalized.split(/[\\/]/);
  const candidate = chunks[chunks.length - 1];
  return candidate || "target-repo";
}

export function parseMemoryTiers(value) {
  const raw = String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (raw.length === 0) {
    throw new Error("--memory-tiers requires at least one integer tier.");
  }

  const tiers = raw.map((entry) => {
    const parsed = Number(entry);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`Invalid memory tier value: ${entry}`);
    }
    return parsed;
  });

  return [...new Set(tiers)];
}

function buildMemoryEnv(memoryTierMb) {
  if (!Number.isInteger(memoryTierMb) || memoryTierMb <= 0) {
    return {};
  }

  const memoryFlag = `--max-old-space-size=${memoryTierMb}`;
  const existing = process.env.NODE_OPTIONS?.trim();
  if (!existing) {
    return { NODE_OPTIONS: memoryFlag };
  }

  const merged = /\b--max-old-space-size=\d+\b/.test(existing)
    ? existing.replace(/\b--max-old-space-size=\d+\b/, memoryFlag)
    : `${memoryFlag} ${existing}`;
  return { NODE_OPTIONS: merged };
}

export function parseArgs(argv) {
  const options = {
    targetPath: null,
    repoUrl: null,
    ref: null,
    compileCmd: null,
    testCmd: null,
    workdir: null,
    memoryTiers: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--repo-url") {
      options.repoUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (current === "--ref") {
      options.ref = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (current === "--compile") {
      options.compileCmd = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (current === "--test") {
      options.testCmd = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (current === "--workdir") {
      options.workdir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (current === "--memory-tiers") {
      options.memoryTiers = parseMemoryTiers(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (current.startsWith("--")) {
      throw new Error(`Unknown option: ${current}`);
    }
    if (options.targetPath) {
      throw new Error(
        "Only one positional target path is supported. Use flags for additional options.",
      );
    }
    options.targetPath = current;
  }

  if (!options.targetPath && !options.repoUrl) {
    throw new Error(
      "Missing target. Provide a local <repoPath> or use --repo-url <url>.",
    );
  }
  if (options.targetPath && options.repoUrl) {
    throw new Error(
      "Use either <repoPath> or --repo-url, not both in the same run.",
    );
  }
  if (options.repoUrl && !options.workdir) {
    options.workdir = ".codemod-eval";
  }
  if (options.memoryTiers.length > 0 && !options.repoUrl) {
    throw new Error("--memory-tiers is supported only with --repo-url mode.");
  }
  return options;
}

export function buildRegressionSummary({ baseline, postCodemod }) {
  const compileRegression =
    baseline.compile?.status === 0 && postCodemod.compile?.status !== 0;
  const testRegression = baseline.test?.status === 0 && postCodemod.test?.status !== 0;
  return {
    compile: Boolean(compileRegression),
    test: Boolean(testRegression),
    any: Boolean(compileRegression || testRegression),
  };
}

function isOomFailure(result) {
  if (!result || result.status === 0) {
    return false;
  }
  const output = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.toLowerCase();
  return (
    output.includes("heap out of memory") ||
    output.includes("reached heap limit") ||
    output.includes("allocation failed")
  );
}

function requestedChecksFromOptions(options) {
  return {
    compile: Boolean(options.compileCmd),
    test: Boolean(options.testCmd),
  };
}

function getRequestedChecks(requested) {
  return ["compile", "test"].filter((checkName) => requested[checkName]);
}

function getSymmetricOomChecks({ baseline, postCodemod, requested }) {
  const checks = getRequestedChecks(requested);
  return checks.filter(
    (checkName) =>
      isOomFailure(baseline[checkName]) && isOomFailure(postCodemod[checkName]),
  );
}

export function buildVerdictSummary({ baseline, postCodemod, regression, requested }) {
  if (regression.any) {
    const regressedCheck = regression.compile ? "compile" : "test";
    return {
      verdict: "regression",
      reason: `Baseline ${regressedCheck} passed but post-codemod ${regressedCheck} failed.`,
      oomChecks: [],
    };
  }

  const checks = getRequestedChecks(requested);

  if (checks.length === 0) {
    return {
      verdict: "pass",
      reason: "No compile/test command provided for evaluation.",
      oomChecks: [],
    };
  }

  const allPass = checks.every(
    (checkName) =>
      baseline[checkName]?.status === 0 && postCodemod[checkName]?.status === 0,
  );

  if (allPass) {
    return {
      verdict: "pass",
      reason: "All requested baseline and post-codemod checks passed.",
      oomChecks: [],
    };
  }

  const oomChecks = getSymmetricOomChecks({
    baseline,
    postCodemod,
    requested,
  });
  if (oomChecks.length > 0) {
    return {
      verdict: "environment-limited",
      reason: `Baseline and post-codemod ${oomChecks.join(
        ", ",
      )} checks both failed with out-of-memory errors on this host.`,
      oomChecks,
    };
  }

  return {
    verdict: "environment-limited",
    reason:
      "Requested checks did not fully pass on this host, but no baseline-to-post regression was detected.",
    oomChecks: [],
  };
}

export function shouldRetryWithNextTier(verdictSummary) {
  return (
    verdictSummary.verdict === "environment-limited" &&
    (verdictSummary.oomChecks?.length ?? 0) > 0
  );
}

export function resolveAttemptTiers({ repoUrl, memoryTiers }) {
  if (repoUrl && memoryTiers.length > 0) {
    return memoryTiers;
  }
  return [null];
}

export function buildWorkflowRunCommand({
  workflowPath,
  targetPath,
  dryRun = false,
  aiReview = false,
}) {
  const args = [
    "codemod@latest",
    "workflow",
    "run",
    "-w",
    shellQuote(workflowPath),
    "-t",
    shellQuote(targetPath),
    "--no-interactive",
    "--allow-dirty",
    "--allow-fs",
    "--param",
    `aiReview=${aiReview}`,
  ];

  if (dryRun) {
    args.push("--dry-run");
  }

  return {
    command: `npx ${args.join(" ")}`,
  };
}

async function resolveTargetFromRepoUrl({ repoUrl, ref, workdir }) {
  const workdirRoot = path.resolve(workdir);
  await fs.mkdir(workdirRoot, { recursive: true });
  const repoName = repoNameFromUrl(repoUrl);
  const target = path.join(workdirRoot, repoName);
  const setup = {};

  if (!(await pathExists(target))) {
    setup.clone = runShell(`git clone "${repoUrl}" "${target}"`, process.cwd());
    if (setup.clone.status !== 0) {
      throw new Error(setup.clone.stderr || "Failed to clone repository.");
    }
  } else {
    setup.fetch = runShell(`git -C "${target}" fetch --all --tags`, process.cwd());
    if (setup.fetch.status !== 0) {
      throw new Error(setup.fetch.stderr || "Failed to fetch repository updates.");
    }
  }

  if (ref) {
    setup.checkout = runShell(`git -C "${target}" checkout "${ref}"`, process.cwd());
    if (setup.checkout.status !== 0) {
      throw new Error(setup.checkout.stderr || `Failed to checkout ref: ${ref}`);
    }
  }

  return { target, setup };
}

function makeAttemptSummary({
  memoryTierMb,
  baseline,
  codemod,
  postCodemod,
  regression,
  verdictSummary,
}) {
  return {
    memory_tier_mb: memoryTierMb,
    baseline,
    codemod,
    post_codemod: postCodemod,
    regression,
    verdict: verdictSummary.verdict,
    reason: verdictSummary.reason,
  };
}

export function finalizeSummaryFromAttempts(summary, attempts) {
  if (attempts.length === 0) {
    return summary;
  }

  const selectedAttemptIndex = attempts.length - 1;
  const selectedAttempt = attempts[selectedAttemptIndex];
  return {
    ...summary,
    attempts,
    selected_attempt_index: selectedAttemptIndex,
    selected_tier_mb: selectedAttempt.memory_tier_mb ?? null,
    baseline: selectedAttempt.baseline,
    codemod: selectedAttempt.codemod,
    post_codemod: selectedAttempt.post_codemod,
    regression: selectedAttempt.regression,
    verdict: selectedAttempt.verdict,
    reason: selectedAttempt.reason,
  };
}

async function resetRepoToHead(target) {
  const reset = runShell(`git -C "${target}" reset --hard HEAD`, process.cwd());
  if (reset.status !== 0) {
    throw new Error(reset.stderr || "Failed to reset repository between attempts.");
  }
}

async function main() {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const options = parseArgs(process.argv.slice(2));
  let target = null;
  const setup = {};
  if (options.repoUrl) {
    const resolved = await resolveTargetFromRepoUrl({
      repoUrl: options.repoUrl,
      ref: options.ref,
      workdir: options.workdir,
    });
    target = resolved.target;
    Object.assign(setup, resolved.setup);
  } else {
    target = path.resolve(options.targetPath);
  }

  if (!(await pathExists(target))) {
    throw new Error(`Target path does not exist: ${target}`);
  }

  const summary = {
    target_path: target,
    repo_url: options.repoUrl,
    ref: options.ref,
    setup,
    baseline: {},
    codemod: null,
    post_codemod: {},
    regression: {
      compile: false,
      test: false,
      any: false,
    },
    attempts: [],
    selected_attempt_index: null,
    selected_tier_mb: null,
    verdict: "environment-limited",
    reason: "Evaluation is incomplete.",
  };

  const requested = requestedChecksFromOptions(options);
  const attemptTiers = resolveAttemptTiers(options);
  const attempts = [];

  for (let attemptIndex = 0; attemptIndex < attemptTiers.length; attemptIndex += 1) {
    const memoryTierMb = attemptTiers[attemptIndex];
    const commandEnv = buildMemoryEnv(memoryTierMb);

    if (attemptIndex > 0 && options.repoUrl) {
      await resetRepoToHead(target);
    }

    const baseline = {};
    const postCodemod = {};
    const emptyRegression = {
      compile: false,
      test: false,
      any: false,
    };

    if (options.compileCmd) {
      baseline.compile = runShell(options.compileCmd, target, commandEnv);
    }
    if (options.testCmd) {
      baseline.test = runShell(options.testCmd, target, commandEnv);
    }

    const workflowInvocation = buildWorkflowRunCommand({
      workflowPath: packageRoot,
      targetPath: target,
      dryRun: false,
    });
    const codemodResult = runShell(
      workflowInvocation.command,
      process.cwd(),
      commandEnv,
    );
    if (codemodResult.status !== 0) {
      attempts.push(
        makeAttemptSummary({
          memoryTierMb,
          baseline,
          codemod: codemodResult,
          postCodemod,
          regression: emptyRegression,
          verdictSummary: {
            verdict: "environment-limited",
            reason: `Codemod execution failed with status ${codemodResult.status}.`,
          },
        }),
      );

      const failedSummary = finalizeSummaryFromAttempts(summary, attempts);
      const summaryPath = path.join(target, "evaluation-summary.json");
      await fs.writeFile(summaryPath, JSON.stringify(failedSummary, null, 2), "utf8");
      process.stderr.write(`Codemod execution failed. See: ${summaryPath}\n`);
      process.exit(codemodResult.status);
    }

    if (options.compileCmd) {
      postCodemod.compile = runShell(options.compileCmd, target, commandEnv);
    }
    if (options.testCmd) {
      postCodemod.test = runShell(options.testCmd, target, commandEnv);
    }

    const regression = buildRegressionSummary({
      baseline,
      postCodemod,
    });
    const verdictSummary = buildVerdictSummary({
      baseline,
      postCodemod,
      regression,
      requested,
    });
    attempts.push(
      makeAttemptSummary({
        memoryTierMb,
        baseline,
        codemod: codemodResult,
        postCodemod,
        regression,
        verdictSummary,
      }),
    );

    const hasNextTier = attemptIndex < attemptTiers.length - 1;
    if (!hasNextTier || !shouldRetryWithNextTier(verdictSummary)) {
      break;
    }
  }

  const finalSummary = finalizeSummaryFromAttempts(summary, attempts);

  const summaryPath = path.join(target, "evaluation-summary.json");
  await fs.writeFile(summaryPath, JSON.stringify(finalSummary, null, 2), "utf8");

  process.stdout.write(`Wrote evaluation summary: ${summaryPath}\n`);
  if (finalSummary.verdict === "regression") {
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
