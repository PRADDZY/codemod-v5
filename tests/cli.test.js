import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "oz-codemod-test-"));
}

describe("CLI", () => {
  it("writes rich migration-report.json and preserves files in dry-run mode", async () => {
    const dir = await makeTempDir();
    const contractsDir = path.join(dir, "contracts");
    await fs.mkdir(contractsDir, { recursive: true });
    const filePath = path.join(contractsDir, "Vault.sol");
    const input = [
      'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";',
      "contract Vault is ReentrancyGuard {}",
      "",
    ].join("\n");
    await fs.writeFile(filePath, input, "utf8");

    const cliPath = path.resolve("src/cli.js");
    const reportPath = path.join(dir, "migration-report.json");

    const run = spawnSync(
      process.execPath,
      [cliPath, "--dry-run", "--report-json", reportPath, dir],
      { encoding: "utf8" },
    );

    expect(run.status).toBe(0);

    const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
    expect(report.files_scanned).toBe(1);
    expect(report.files_changed).toBe(1);
    expect(report.fp_checks).toBe(0);
    expect(report.todo_count).toBe(0);
    expect(report.rule_hits.contracts_security_reentrancyguard_import).toBe(1);
    expect(report.todo_by_category).toEqual({});
    expect(report.todo_locations).toEqual([]);

    const after = await fs.readFile(filePath, "utf8");
    expect(after).toBe(input);
  });

  it("fails strict mode when unresolved TODO markers are present", async () => {
    const dir = await makeTempDir();
    const contractsDir = path.join(dir, "contracts");
    await fs.mkdir(contractsDir, { recursive: true });
    const filePath = path.join(contractsDir, "Vault.sol");
    const input = [
      'import "@openzeppelin/contracts/access/Ownable.sol";',
      "contract Vault is Ownable {",
      "  constructor() {}",
      "}",
      "",
    ].join("\n");
    await fs.writeFile(filePath, input, "utf8");

    const cliPath = path.resolve("src/cli.js");
    const reportPath = path.join(dir, "migration-report.json");

    const run = spawnSync(
      process.execPath,
      [cliPath, "--apply", "--strict", "--report-json", reportPath, dir],
      { encoding: "utf8" },
    );

    expect(run.status).toBe(2);

    const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
    expect(report.todo_count).toBe(1);
    expect(report.todo_by_category.ownable_constructor_initial_owner).toBe(1);
    expect(report.todo_locations[0].file).toBe("contracts/Vault.sol");
  });
});
