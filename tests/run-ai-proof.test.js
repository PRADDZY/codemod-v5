import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectTodoCounts,
  countTodoMarkersInSource,
  parseAiProofArgs,
} from "../scripts/run-ai-proof.js";

describe("run-ai-proof argument parsing", () => {
  it("parses required target with optional workflow and output", () => {
    const parsed = parseAiProofArgs([
      "--target",
      "./repo",
      "--workflow-path",
      ".",
      "--output",
      "./out.json",
    ]);

    expect(parsed.target).toBe("./repo");
    expect(parsed.workflowPath).toBe(".");
    expect(parsed.output).toBe("./out.json");
    expect(parsed.help).toBe(false);
  });

  it("marks help mode", () => {
    const parsed = parseAiProofArgs(["--help"]);
    expect(parsed.help).toBe(true);
  });

  it("rejects missing target", () => {
    expect(() => parseAiProofArgs([])).toThrow("Missing --target <path>.");
  });

  it("rejects unknown arguments", () => {
    expect(() => parseAiProofArgs(["--target", ".", "--bad"])).toThrow(
      "Unknown option: --bad",
    );
  });
});

describe("run-ai-proof todo counters", () => {
  it("counts TODO markers by category", () => {
    const counts = countTodoMarkersInSource(`
      // OZ-V5-TODO[token_hooks_update_migration]
      // OZ-V5-TODO[token_hooks_update_migration]
      // OZ-V5-TODO[removed_module_usage]
    `);

    expect(counts.total).toBe(3);
    expect(counts.categories).toEqual({
      token_hooks_update_migration: 2,
      removed_module_usage: 1,
    });
  });

  it("collects markers across solidity files while respecting ignore rules", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "run-ai-proof-"));
    try {
      await fs.writeFile(
        path.join(root, "A.sol"),
        "// OZ-V5-TODO[token_hooks_update_migration]\n",
        "utf8",
      );
      await fs.writeFile(path.join(root, "B.sol"), "contract B {}", "utf8");
      await fs.mkdir(path.join(root, "node_modules"), { recursive: true });
      await fs.writeFile(
        path.join(root, "node_modules", "Ignored.sol"),
        "// OZ-V5-TODO[removed_module_usage]\n",
        "utf8",
      );

      const summary = await collectTodoCounts(root);
      expect(summary.scanned_files).toBe(2);
      expect(summary.total).toBe(1);
      expect(summary.categories).toEqual({
        token_hooks_update_migration: 1,
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
