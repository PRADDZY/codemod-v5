#!/usr/bin/env node
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";

function runProgram(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return {
    command: `${command} ${args.join(" ")}`.trim(),
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runShell(command, cwd) {
  const result = spawnSync(command, { cwd, encoding: "utf8", shell: true });
  return {
    command,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
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

export function parseArgs(argv) {
  const options = {
    targetPath: null,
    repoUrl: null,
    ref: null,
    compileCmd: null,
    testCmd: null,
    workdir: null,
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

async function main() {
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

  const reportPath = path.join(target, "migration-report.json");
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
  };

  if (options.compileCmd) {
    summary.baseline.compile = runShell(options.compileCmd, target);
  }
  if (options.testCmd) {
    summary.baseline.test = runShell(options.testCmd, target);
  }

  summary.codemod = runProgram(
    process.execPath,
    [
      path.resolve("src/cli.js"),
      "--apply",
      "--report-json",
      reportPath,
      target,
    ],
    process.cwd(),
  );
  if (summary.codemod.status !== 0) {
    const summaryPath = path.join(target, "evaluation-summary.json");
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
    process.stderr.write(`Codemod execution failed. See: ${summaryPath}\n`);
    process.exit(summary.codemod.status);
  }

  if (options.compileCmd) {
    summary.post_codemod.compile = runShell(options.compileCmd, target);
  }
  if (options.testCmd) {
    summary.post_codemod.test = runShell(options.testCmd, target);
  }

  summary.regression = buildRegressionSummary({
    baseline: summary.baseline,
    postCodemod: summary.post_codemod,
  });

  const summaryPath = path.join(target, "evaluation-summary.json");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  process.stdout.write(`Wrote evaluation summary: ${summaryPath}\n`);
  if (summary.regression.any) {
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
