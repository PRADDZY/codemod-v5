import { describe, expect, it } from "vitest";
import {
  extractTodoCategories,
  summarizeScenario,
} from "../scripts/build-live-demo-data.js";

describe("build-live-demo-data helpers", () => {
  it("extracts TODO categories from codemod stdout", () => {
    const categories = extractTodoCategories(
      [
        "Metrics:",
        "  todo_markers:",
        "    10",
        "  todo_categories:",
        "    category=ownable_constructor_initial_owner: 9",
        "    category=import_path_layout_review: 1",
      ].join("\n"),
    );

    expect(categories).toEqual([
      { category: "ownable_constructor_initial_owner", count: 9 },
      { category: "import_path_layout_review", count: 1 },
    ]);
  });

  it("builds a stable scenario payload shape", () => {
    const scenario = summarizeScenario({
      verdictTarget: {
        repo: "repo-a",
        verdict: "pass",
        reason: "ok",
        selected_tier_mb: 4096,
        baseline_compile: 0,
        baseline_test: 0,
        post_compile: 0,
        post_test: 0,
        evaluation_duration_ms: 1234,
      },
      evaluationSummary: {
        repo_url: "https://github.com/example/repo-a.git",
        ref: "main",
        attempts: [
          {
            codemod: {
              duration_ms: 42,
              stdout: "category=import_path_layout_review: 3",
            },
            baseline: {
              compile: { duration_ms: 7, stdout: "compile ok" },
              test: { duration_ms: 8, stdout: "test ok" },
            },
            post_codemod: {
              compile: { duration_ms: 9, stdout: "compile ok" },
              test: { duration_ms: 10, stdout: "test ok" },
            },
            regression: { any: false },
          },
        ],
      },
      evidenceRunUrl: "https://example.com/run",
    });

    expect(scenario.id).toBe("repo-a");
    expect(scenario.verdict).toBe("pass");
    expect(scenario.todo_markers.categories[0]).toEqual({
      category: "import_path_layout_review",
      count: 3,
    });
    expect(scenario.evidence_links.workflow_run_url).toBe(
      "https://example.com/run",
    );
    expect(Array.isArray(scenario.diff_samples)).toBe(true);
  });
});
