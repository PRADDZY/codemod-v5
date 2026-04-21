import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "oz-workflow-test-"));
}

describe("Codemod workflow", () => {
  it(
    "runs the package workflow in preview mode without mutating files",
    async () => {
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

    const run = spawnSync(
      `npx codemod@latest workflow run -w "${path.resolve(".")}" -t "${dir}" --no-interactive --allow-dirty --allow-fs --dry-run`,
      { encoding: "utf8", shell: true },
    );

    expect(run.status).toBe(0);

    const after = await fs.readFile(filePath, "utf8");
    expect(after).toBe(input);
      expect(`${run.stdout}${run.stderr}`).toContain("Workflow started");
    },
    20000,
  );

  it(
    "applies workflow changes when dry-run is not requested",
    async () => {
      const dir = await makeTempDir();
      const contractsDir = path.join(dir, "contracts");
      const ozDir = path.join(
        dir,
        "node_modules",
        "@openzeppelin",
        "contracts",
        "utils",
      );
      await fs.mkdir(contractsDir, { recursive: true });
      await fs.mkdir(ozDir, { recursive: true });
      await fs.writeFile(
        path.join(ozDir, "ReentrancyGuard.sol"),
        "// stub\n",
        "utf8",
      );

      const filePath = path.join(contractsDir, "Vault.sol");
      await fs.writeFile(
        filePath,
        [
          'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";',
          "contract Vault is ReentrancyGuard {}",
          "",
        ].join("\n"),
        "utf8",
      );

      const run = spawnSync(
        `npx codemod@latest workflow run -w "${path.resolve(".")}" -t "${dir}" --no-interactive --allow-dirty --allow-fs`,
        { encoding: "utf8", shell: true },
      );

      expect(run.status).toBe(0);

      const after = await fs.readFile(filePath, "utf8");
      expect(after).toContain(
        'import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";',
      );
      expect(after).not.toContain(
        'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";',
      );
    },
    20000,
  );
});
