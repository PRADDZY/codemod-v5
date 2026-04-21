#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pc from "picocolors";
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { runCodemod } from "./engine.js";

const program = new Command();

program
  .name("oz-v4-to-v5")
  .description(
    "Deterministic codemod for OpenZeppelin Contracts v4 -> v5 upgrades",
  )
  .argument("<targetPath>", "Path to Solidity project")
  .option("--dry-run", "Analyze and report without writing files")
  .option("--apply", "Write codemod changes to files")
  .option(
    "--report-json <filePath>",
    "Write migration report JSON to this path",
    "migration-report.json",
  )
  .option("--config <filePath>", "Load codemod config JSON")
  .option("--strict", "Exit non-zero if unresolved TODO markers are found")
  .action(async (targetPath, options) => {
    if (options.dryRun && options.apply) {
      throw new Error("Choose either --dry-run or --apply, not both.");
    }

    const cfg = await loadConfig(options.config);
    const dryRun = options.apply ? false : true;

    const report = await runCodemod({
      rootPath: targetPath,
      dryRun,
      include: cfg.include,
      exclude: cfg.exclude,
      strict: options.strict || cfg.strict,
    });

    const reportPath = path.resolve(options.reportJson);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

    const modeLabel = dryRun ? pc.yellow("dry-run") : pc.green("apply");
    process.stdout.write(`${pc.bold("oz-v4-to-v5")} (${modeLabel})\n`);
    process.stdout.write(`Scanned: ${report.files_scanned}\n`);
    process.stdout.write(`Changed: ${report.files_changed}\n`);
    process.stdout.write(`TODOs: ${report.todo_count}\n`);
    process.stdout.write(`Report: ${reportPath}\n`);

    if ((options.strict || cfg.strict) && report.todo_count > 0) {
      process.stderr.write(
        pc.red(
          `Strict mode failed: ${report.todo_count} unresolved OZ-V5-TODO marker(s).\n`,
        ),
      );
      process.exitCode = 2;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(pc.red(`Error: ${error.message}\n`));
  process.exit(1);
});
