import { describe, expect, it } from "vitest";
import {
  parseMatrixArgs,
  shouldRunTargetTests,
  summarizeEvaluationDoc,
} from "../scripts/full-matrix-evaluate.js";

describe("full-matrix-evaluate argument parsing", () => {
  it("uses full-mode defaults", () => {
    const parsed = parseMatrixArgs([]);
    expect(parsed.mode).toBe("full");
    expect(parsed.workdir).toBe(".codemod-eval-final");
    expect(parsed.memoryTiers).toEqual([4096, 6144, 8192, 12288, 16384]);
    expect(parsed.hardhatShardSize).toBe(20);
  });

  it("parses explicit mode/workdir/memory tiers/shard size", () => {
    const parsed = parseMatrixArgs([
      "--mode",
      "smoke",
      "--workdir",
      ".runs",
      "--memory-tiers",
      "4096,6144",
      "--hardhat-shard-size",
      "12",
    ]);
    expect(parsed.mode).toBe("smoke");
    expect(parsed.workdir).toBe(".runs");
    expect(parsed.memoryTiers).toEqual([4096, 6144]);
    expect(parsed.hardhatShardSize).toBe(12);
  });

  it("rejects invalid mode values", () => {
    expect(() => parseMatrixArgs(["--mode", "invalid"])).toThrow(
      "Invalid --mode value",
    );
  });

  it("rejects invalid shard-size values", () => {
    expect(() =>
      parseMatrixArgs(["--hardhat-shard-size", "0"]),
    ).toThrow("Invalid --hardhat-shard-size value");
  });
});

describe("full-matrix-evaluate mode behavior", () => {
  it("runs tests for every target in full mode", () => {
    expect(
      shouldRunTargetTests("full", "foundry-defi-stablecoin-cu"),
    ).toBe(true);
    expect(shouldRunTargetTests("full", "openzeppelin-contracts")).toBe(true);
    expect(
      shouldRunTargetTests("full", "openzeppelin-contracts-upgradeable"),
    ).toBe(true);
  });

  it("runs tests only for foundry target in mixed mode", () => {
    expect(
      shouldRunTargetTests("mixed", "foundry-defi-stablecoin-cu"),
    ).toBe(true);
    expect(shouldRunTargetTests("mixed", "openzeppelin-contracts")).toBe(false);
    expect(
      shouldRunTargetTests("mixed", "openzeppelin-contracts-upgradeable"),
    ).toBe(false);
  });

  it("runs compile-only in smoke mode", () => {
    expect(
      shouldRunTargetTests("smoke", "foundry-defi-stablecoin-cu"),
    ).toBe(false);
    expect(shouldRunTargetTests("smoke", "openzeppelin-contracts")).toBe(false);
  });
});

describe("full-matrix-evaluate summary mapping", () => {
  it("maps an evaluation-summary document into a flat verdict row", () => {
    const row = summarizeEvaluationDoc({
      targetName: "openzeppelin-contracts",
      evaluationExitCode: 0,
      evaluationDurationMs: 4567,
      doc: {
        verdict: "pass",
        reason: "All checks passed",
        selected_tier_mb: 6144,
        baseline: {
          compile: { status: 0 },
          test: { status: 0 },
        },
        post_codemod: {
          compile: { status: 0 },
          test: { status: 0 },
        },
      },
    });

    expect(row.summary_found).toBe(true);
    expect(row.verdict).toBe("pass");
    expect(row.selected_tier_mb).toBe(6144);
    expect(row.baseline_compile).toBe(0);
    expect(row.baseline_test).toBe(0);
    expect(row.post_compile).toBe(0);
    expect(row.post_test).toBe(0);
    expect(row.evaluation_duration_ms).toBe(4567);
  });

  it("returns a missing-summary row when evaluation-summary.json is absent", () => {
    const row = summarizeEvaluationDoc({
      targetName: "openzeppelin-contracts-upgradeable",
      evaluationExitCode: 1,
      evaluationDurationMs: 8901,
      doc: null,
    });

    expect(row.summary_found).toBe(false);
    expect(row.verdict).toBeNull();
    expect(row.reason).toBe("Missing evaluation-summary.json");
    expect(row.evaluation_exit_code).toBe(1);
    expect(row.evaluation_duration_ms).toBe(8901);
  });
});
