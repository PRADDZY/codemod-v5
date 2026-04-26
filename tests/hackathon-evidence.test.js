import { describe, expect, it } from "vitest";
import {
  buildRequirementReport,
  parseEvidenceArgs,
} from "../scripts/hackathon-evidence.js";

describe("hackathon-evidence argument parsing", () => {
  it("uses defaults", () => {
    const parsed = parseEvidenceArgs([]);
    expect(parsed.workdirs).toEqual([".codemod-eval-final", ".codemod-eval"]);
    expect(parsed.aiProof).toBeNull();
    expect(parsed.output).toBe("hackathon-requirements.json");
    expect(parsed.help).toBe(false);
  });

  it("parses explicit workdirs, ai proof and output", () => {
    const parsed = parseEvidenceArgs([
      "--workdirs",
      ".runs,.backup",
      "--ai-proof",
      ".runs/ai-proof.json",
      "--output",
      ".runs/report.json",
    ]);

    expect(parsed.workdirs).toEqual([".runs", ".backup"]);
    expect(parsed.aiProof).toBe(".runs/ai-proof.json");
    expect(parsed.output).toBe(".runs/report.json");
  });

  it("rejects unknown options", () => {
    expect(() => parseEvidenceArgs(["--bad"])).toThrow("Unknown option: --bad");
  });
});

describe("hackathon-evidence reporting", () => {
  it("reports full completion when all requirement proofs are present", () => {
    const report = buildRequirementReport({
      readmeText: "OpenZeppelin contracts migration to v5",
      workflowText: "steps:\n  - js-ast-grep:\n  - ai:\nparams:\n  aiReview: false\n",
      hasCodemodScript: true,
      evaluationDocs: [
        {
          doc: {
            baseline: {
              compile: { status: 0 },
              test: { status: 0 },
            },
            post_codemod: {
              compile: { status: 0 },
              test: { status: 0 },
            },
            regression: { any: false },
          },
        },
      ],
      aiProofDoc: { workflow: { status: 0 } },
    });

    expect(report.completion_percent).toBe(100);
    expect(report.requirements.every((entry) => entry.status === "completed")).toBe(
      true,
    );
  });

  it("reports partial completion when AI proof and full pass evidence are missing", () => {
    const report = buildRequirementReport({
      readmeText: "OpenZeppelin v5 upgrade guide",
      workflowText: "steps:\n  - js-ast-grep:\n  - ai:\nparams:\n  aiReview: false\n",
      hasCodemodScript: true,
      evaluationDocs: [
        {
          doc: {
            baseline: {
              compile: { status: 0 },
            },
            post_codemod: {
              compile: { status: 0 },
            },
            regression: { any: false },
          },
        },
      ],
      aiProofDoc: null,
    });

    expect(report.completion_percent).toBe(75);
    expect(
      report.requirements.find((entry) => entry.id === "use_ai_for_edge_cases")
        ?.status,
    ).toBe("partial");
    expect(
      report.requirements.find(
        (entry) => entry.id === "prove_it_works_on_real_repo",
      )?.status,
    ).toBe("partial");
  });
});
