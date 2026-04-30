import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMetrics,
  ensureRequiredLinks,
  isValidHttpUrl,
  parseSubmissionPackArgs,
  pickPrimaryEvidence,
  summarizeEvaluationDoc,
} from "../scripts/submission-pack.js";

describe("submission-pack argument parsing", () => {
  it("uses defaults", () => {
    const parsed = parseSubmissionPackArgs([]);
    expect(parsed.workdirs).toEqual([".codemod-eval-final", ".codemod-eval"]);
    expect(parsed.requirements).toBe(".codemod-eval-final/hackathon-requirements.json");
    expect(parsed.aiProof).toBe(".codemod-eval-final/ai-proof-summary.json");
    expect(parsed.outputDir).toBe(".codemod-eval-final/submission-pack");
    expect(parsed.help).toBe(false);
    expect(parsed.strictLinks).toBe(false);
  });

  it("parses explicit paths and links", () => {
    const parsed = parseSubmissionPackArgs([
      "--workdirs",
      ".runs,.archive",
      "--requirements",
      ".runs/hackathon.json",
      "--ai-proof",
      ".runs/ai.json",
      "--output-dir",
      ".runs/submission",
      "--repo-url",
      "https://github.com/example/repo",
      "--registry-url",
      "https://app.codemod.com/registry/example",
      "--package-name",
      "@example/pkg",
      "--demo-url",
      "https://example.com/demo",
      "--case-study-url",
      "https://example.com/case-study",
      "--strict-links",
    ]);

    expect(parsed.workdirs).toEqual([".runs", ".archive"]);
    expect(parsed.requirements).toBe(".runs/hackathon.json");
    expect(parsed.aiProof).toBe(".runs/ai.json");
    expect(parsed.outputDir).toBe(".runs/submission");
    expect(parsed.repoUrl).toBe("https://github.com/example/repo");
    expect(parsed.registryUrl).toBe("https://app.codemod.com/registry/example");
    expect(parsed.packageName).toBe("@example/pkg");
    expect(parsed.demoUrl).toBe("https://example.com/demo");
    expect(parsed.caseStudyUrl).toBe("https://example.com/case-study");
    expect(parsed.strictLinks).toBe(true);
  });

  it("rejects unknown options", () => {
    expect(() => parseSubmissionPackArgs(["--bad"])).toThrow(
      "Unknown option: --bad",
    );
  });
});

describe("submission-pack evidence synthesis", () => {
  it("normalizes summary paths to repository relative form", () => {
    const absoluteSummaryPath = path.resolve(
      ".codemod-eval-final/repo-a/evaluation-summary.json",
    );
    const normalized = summarizeEvaluationDoc({
      target: "repo-a",
      summaryPath: absoluteSummaryPath,
      doc: {
        baseline: { compile: { status: 0 }, test: { status: 0 } },
        post_codemod: { compile: { status: 0 }, test: { status: 0 } },
        regression: { any: false },
      },
    });
    expect(normalized.summary_path).toBe(
      ".codemod-eval-final/repo-a/evaluation-summary.json",
    );
    expect(normalized.summary_path).toContain("evaluation-summary.json");
  });

  it("normalizes evaluation summaries", () => {
    const normalized = summarizeEvaluationDoc({
      target: "repo-a",
      summaryPath: "C:/tmp/repo-a/evaluation-summary.json",
      doc: {
        repo_url: "https://github.com/example/repo-a.git",
        ref: "main",
        baseline: { compile: { status: 0 }, test: { status: 1 } },
        post_codemod: { compile: { status: 0 }, test: { status: 1 } },
        regression: { any: false },
        verdict: "environment-limited",
        reason: "OOM",
        selected_tier_mb: 6144,
      },
    });

    expect(normalized.target).toBe("repo-a");
    expect(normalized.baseline_compile).toBe(0);
    expect(normalized.baseline_test).toBe(1);
    expect(normalized.post_compile).toBe(0);
    expect(normalized.post_test).toBe(1);
    expect(normalized.regression_any).toBe(false);
    expect(normalized.verdict).toBe("environment-limited");
    expect(normalized.selected_tier_mb).toBe(6144);
  });

  it("prefers a full pass repo as primary evidence", () => {
    const selected = pickPrimaryEvidence([
      {
        target: "repo-a",
        baseline_compile: 0,
        baseline_test: 1,
        post_compile: 0,
        post_test: 1,
        regression_any: false,
      },
      {
        target: "repo-b",
        baseline_compile: 0,
        baseline_test: 0,
        post_compile: 0,
        post_test: 0,
        regression_any: false,
      },
    ]);

    expect(selected?.target).toBe("repo-b");
  });

  it("builds metrics with requirement and AI status", () => {
    const metrics = buildMetrics({
      requirementsDoc: {
        completion_percent: 100,
        requirements: [
          { id: "pick_real_world_upgrade", status: "completed" },
          { id: "build_codemods_to_automate", status: "completed" },
          { id: "use_ai_for_edge_cases", status: "completed" },
          { id: "prove_it_works_on_real_repo", status: "completed" },
        ],
      },
      aiProofDoc: {
        before_todos: { total: 12, scanned_files: 30 },
        after_todos: { total: 9 },
        workflow: { status: 0 },
      },
      evaluations: [
        {
          target: "repo-b",
          baseline_compile: 0,
          baseline_test: 0,
          post_compile: 0,
          post_test: 0,
          regression_any: false,
          verdict: "pass",
        },
      ],
      links: {
        github_repo: "https://github.com/example/repo",
        codemod_registry: "https://app.codemod.com/registry/example",
        package_name: "@example/pkg",
      },
    });

    expect(metrics.hackathon_completion_percent).toBe(100);
    expect(metrics.ai_proof.workflow_status).toBe(0);
    expect(metrics.ai_proof.todo_delta).toBe(-3);
    expect(metrics.requirement_statuses.prove_it_works_on_real_repo).toBe(
      "completed",
    );
  });
});

describe("submission-pack link guards", () => {
  it("validates http links", () => {
    expect(isValidHttpUrl("https://example.com")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
    expect(isValidHttpUrl("not-a-url")).toBe(false);
  });

  it("requires links when strict mode is enabled", () => {
    expect(() =>
      ensureRequiredLinks({
        strictLinks: true,
        demoUrl: "",
        caseStudyUrl: "https://example.com/case",
      }),
    ).toThrow("Missing or invalid demo URL");

    expect(() =>
      ensureRequiredLinks({
        strictLinks: true,
        demoUrl: "https://example.com/demo",
        caseStudyUrl: "",
      }),
    ).toThrow("Missing or invalid case-study URL");

    expect(() =>
      ensureRequiredLinks({
        strictLinks: true,
        demoUrl: "https://example.com/demo",
        caseStudyUrl: "https://example.com/case",
      }),
    ).not.toThrow();
  });
});
