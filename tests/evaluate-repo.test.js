import { describe, expect, it } from "vitest";
import {
  buildVerdictSummary,
  buildRegressionSummary,
  buildWorkflowRunCommand,
  finalizeSummaryFromAttempts,
  parseMemoryTiers,
  parseArgs,
  resolveAttemptTiers,
  repoNameFromUrl,
  shouldRetryWithNextTier,
} from "../scripts/evaluate-repo.js";

describe("evaluate-repo argument parsing", () => {
  it("parses local target with compile and test commands", () => {
    const parsed = parseArgs([
      "./repo",
      "--compile",
      "forge build",
      "--test",
      "forge test",
    ]);

    expect(parsed.targetPath).toBe("./repo");
    expect(parsed.compileCmd).toBe("forge build");
    expect(parsed.testCmd).toBe("forge test");
    expect(parsed.repoUrl).toBeNull();
  });

  it("parses repo-url mode and assigns default workdir", () => {
    const parsed = parseArgs([
      "--repo-url",
      "https://github.com/OpenZeppelin/openzeppelin-contracts.git",
      "--ref",
      "v4.9.6",
    ]);

    expect(parsed.targetPath).toBeNull();
    expect(parsed.repoUrl).toBe(
      "https://github.com/OpenZeppelin/openzeppelin-contracts.git",
    );
    expect(parsed.ref).toBe("v4.9.6");
    expect(parsed.workdir).toBe(".codemod-eval");
  });

  it("parses memory tiers in repo-url mode", () => {
    const parsed = parseArgs([
      "--repo-url",
      "https://github.com/OpenZeppelin/openzeppelin-contracts.git",
      "--memory-tiers",
      "4096, 6144, 4096",
    ]);

    expect(parsed.memoryTiers).toEqual([4096, 6144]);
  });

  it("rejects ambiguous mode when both positional path and repo-url are provided", () => {
    expect(() =>
      parseArgs([
        "./repo",
        "--repo-url",
        "https://github.com/OpenZeppelin/openzeppelin-contracts.git",
      ]),
    ).toThrow("Use either <repoPath> or --repo-url");
  });

  it("rejects memory tiers when --repo-url mode is not used", () => {
    expect(() =>
      parseArgs(["./repo", "--memory-tiers", "4096,6144"]),
    ).toThrow("--memory-tiers is supported only with --repo-url mode.");
  });
});

describe("evaluate-repo helpers", () => {
  it("derives repository directory names from git URLs", () => {
    expect(
      repoNameFromUrl("https://github.com/OpenZeppelin/openzeppelin-contracts.git"),
    ).toBe("openzeppelin-contracts");
  });

  it("flags baseline->post regressions correctly", () => {
    const regression = buildRegressionSummary({
      baseline: {
        compile: { status: 0 },
        test: { status: 0 },
      },
      postCodemod: {
        compile: { status: 1 },
        test: { status: 0 },
      },
    });

    expect(regression.compile).toBe(true);
    expect(regression.test).toBe(false);
    expect(regression.any).toBe(true);
  });

  it("builds a Codemod workflow invocation for the target repo", () => {
    const invocation = buildWorkflowRunCommand({
      workflowPath: "C:/work/package",
      targetPath: "C:/work/target-repo",
      dryRun: true,
    });

    expect(invocation.command).toMatch(/codemod(@latest)? workflow run/);
    expect(invocation.command).toContain('-w "C:/work/package"');
    expect(invocation.command).toContain('-t "C:/work/target-repo"');
    expect(invocation.command).toContain("--allow-dirty");
    expect(invocation.command).toContain("--dry-run");
    expect(invocation.command).toContain("--param aiReview=false");
  });

  it("returns pass verdict when all requested checks pass", () => {
    const verdict = buildVerdictSummary({
      baseline: {
        compile: { status: 0, stderr: "" },
        test: { status: 0, stderr: "" },
      },
      postCodemod: {
        compile: { status: 0, stderr: "" },
        test: { status: 0, stderr: "" },
      },
      regression: {
        compile: false,
        test: false,
        any: false,
      },
      requested: {
        compile: true,
        test: true,
      },
    });

    expect(verdict.verdict).toBe("pass");
    expect(verdict.reason).toContain("passed");
  });

  it("returns regression verdict when baseline pass regresses post-codemod", () => {
    const verdict = buildVerdictSummary({
      baseline: {
        compile: { status: 0, stderr: "" },
      },
      postCodemod: {
        compile: { status: 1, stderr: "compile failed" },
      },
      regression: {
        compile: true,
        test: false,
        any: true,
      },
      requested: {
        compile: true,
        test: false,
      },
    });

    expect(verdict.verdict).toBe("regression");
    expect(verdict.reason).toContain("Baseline compile passed");
  });

  it("returns environment-limited verdict for symmetric OOM failures", () => {
    const verdict = buildVerdictSummary({
      baseline: {
        test: { status: 134, stderr: "FATAL ERROR: Reached heap limit Allocation failed" },
      },
      postCodemod: {
        test: { status: 134, stderr: "JavaScript heap out of memory" },
      },
      regression: {
        compile: false,
        test: false,
        any: false,
      },
      requested: {
        compile: false,
        test: true,
      },
    });

    expect(verdict.verdict).toBe("environment-limited");
    expect(verdict.reason).toContain("out-of-memory");
    expect(verdict.oomChecks).toEqual(["test"]);
  });

  it("parses and deduplicates memory tiers", () => {
    expect(parseMemoryTiers("4096, 6144,4096")).toEqual([4096, 6144]);
  });

  it("resolves attempt tiers to a single default attempt when retries are disabled", () => {
    expect(
      resolveAttemptTiers({ repoUrl: null, memoryTiers: [4096, 6144] }),
    ).toEqual([null]);
  });

  it("retries only for symmetric OOM environment-limited verdicts", () => {
    const retryVerdict = buildVerdictSummary({
      baseline: {
        test: { status: 134, stderr: "heap out of memory" },
      },
      postCodemod: {
        test: { status: 134, stderr: "Reached heap limit" },
      },
      regression: {
        compile: false,
        test: false,
        any: false,
      },
      requested: {
        compile: false,
        test: true,
      },
    });
    expect(shouldRetryWithNextTier(retryVerdict)).toBe(true);

    const noRetryVerdict = buildVerdictSummary({
      baseline: {
        test: { status: 2, stderr: "Timeout" },
      },
      postCodemod: {
        test: { status: 2, stderr: "Timeout" },
      },
      regression: {
        compile: false,
        test: false,
        any: false,
      },
      requested: {
        compile: false,
        test: true,
      },
    });
    expect(shouldRetryWithNextTier(noRetryVerdict)).toBe(false);
  });

  it("selects the last attempt as the authoritative summary", () => {
    const initialSummary = {
      target_path: "C:/tmp/repo",
      repo_url: "https://github.com/example/repo.git",
      ref: "main",
      setup: {},
      baseline: {},
      codemod: null,
      post_codemod: {},
      regression: { compile: false, test: false, any: false },
      attempts: [],
      selected_attempt_index: null,
      selected_tier_mb: null,
      verdict: "environment-limited",
      reason: "Evaluation is incomplete.",
    };

    const finalized = finalizeSummaryFromAttempts(initialSummary, [
      {
        memory_tier_mb: 4096,
        baseline: { test: { status: 134 } },
        codemod: { status: 0 },
        post_codemod: { test: { status: 134 } },
        regression: { compile: false, test: false, any: false },
        verdict: "environment-limited",
        reason: "OOM",
      },
      {
        memory_tier_mb: 6144,
        baseline: { test: { status: 0 } },
        codemod: { status: 0 },
        post_codemod: { test: { status: 0 } },
        regression: { compile: false, test: false, any: false },
        verdict: "pass",
        reason: "All checks passed",
      },
    ]);

    expect(finalized.verdict).toBe("pass");
    expect(finalized.selected_attempt_index).toBe(1);
    expect(finalized.selected_tier_mb).toBe(6144);
    expect(finalized.attempts).toHaveLength(2);
    expect(finalized.post_codemod.test.status).toBe(0);
  });
});
