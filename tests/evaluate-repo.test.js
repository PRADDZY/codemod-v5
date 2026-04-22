import { describe, expect, it } from "vitest";
import {
  buildVerdictSummary,
  buildRegressionSummary,
  buildWorkflowRunCommand,
  parseArgs,
  repoNameFromUrl,
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

  it("rejects ambiguous mode when both positional path and repo-url are provided", () => {
    expect(() =>
      parseArgs([
        "./repo",
        "--repo-url",
        "https://github.com/OpenZeppelin/openzeppelin-contracts.git",
      ]),
    ).toThrow("Use either <repoPath> or --repo-url");
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
  });
});
