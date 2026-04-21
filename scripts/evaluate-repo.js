#!/usr/bin/env node
import process from "node:process";
import path from "node:path";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return {
    command: `${command} ${args.join(" ")}`.trim(),
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

async function main() {
  const [, , targetArg, ...extra] = process.argv;
  if (!targetArg) {
    process.stderr.write(
      "Usage: node scripts/evaluate-repo.js <repoPath> [--compile \"cmd\"] [--test \"cmd\"]\n",
    );
    process.exit(1);
  }

  const target = path.resolve(targetArg);
  let compileCmd = null;
  let testCmd = null;

  for (let i = 0; i < extra.length; i += 1) {
    if (extra[i] === "--compile") {
      compileCmd = extra[i + 1];
      i += 1;
      continue;
    }
    if (extra[i] === "--test") {
      testCmd = extra[i + 1];
      i += 1;
    }
  }

  const reportPath = path.join(target, "migration-report.json");
  const codemod = run(
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

  const results = { codemod };

  if (compileCmd) {
    const [compileExe, ...compileArgs] = compileCmd.split(" ");
    results.compile = run(compileExe, compileArgs, target);
  }

  if (testCmd) {
    const [testExe, ...testArgs] = testCmd.split(" ");
    results.test = run(testExe, testArgs, target);
  }

  const summaryPath = path.join(target, "evaluation-summary.json");
  await fs.writeFile(summaryPath, JSON.stringify(results, null, 2), "utf8");

  process.stdout.write(`Wrote evaluation summary: ${summaryPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exit(1);
});
