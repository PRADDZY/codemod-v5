#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_WORKDIRS = [".codemod-eval-final", ".codemod-eval"];
const DEFAULT_OUTPUT = "hackathon-requirements.json";

export function parseEvidenceArgs(argv) {
  const options = {
    workdirs: [...DEFAULT_WORKDIRS],
    aiProof: null,
    output: DEFAULT_OUTPUT,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--workdirs") {
      const raw = argv[index + 1] ?? "";
      options.workdirs = raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (current === "--ai-proof") {
      options.aiProof = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (current === "--output") {
      options.output = argv[index + 1] ?? DEFAULT_OUTPUT;
      index += 1;
      continue;
    }
    if (current === "-h" || current === "--help") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown option: ${current}`);
  }

  return options;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function loadEvaluationDocs(workdirs) {
  const docs = [];
  for (const relativeWorkdir of workdirs) {
    const workdir = path.resolve(relativeWorkdir);
    if (!(await pathExists(workdir))) {
      continue;
    }
    const children = await fs.readdir(workdir, { withFileTypes: true });
    for (const entry of children) {
      if (!entry.isDirectory()) {
        continue;
      }
      const summaryPath = path.join(workdir, entry.name, "evaluation-summary.json");
      const doc = await readJsonIfExists(summaryPath);
      if (doc) {
        docs.push({
          source_workdir: workdir,
          target: entry.name,
          summary_path: summaryPath,
          doc,
        });
      }
    }
  }
  return docs;
}

function hasPassingBaselineAndPost(doc) {
  return (
    doc?.baseline?.compile?.status === 0 &&
    doc?.baseline?.test?.status === 0 &&
    doc?.post_codemod?.compile?.status === 0 &&
    doc?.post_codemod?.test?.status === 0 &&
    doc?.regression?.any !== true
  );
}

function hasNonRegressiveRealRepoEvidence(doc) {
  const hasAnyCheck =
    typeof doc?.baseline?.compile?.status === "number" ||
    typeof doc?.baseline?.test?.status === "number" ||
    typeof doc?.post_codemod?.compile?.status === "number" ||
    typeof doc?.post_codemod?.test?.status === "number";
  return hasAnyCheck && doc?.regression?.any !== true;
}

function isAiConfigured(workflowText) {
  return workflowText.includes("aiReview") && workflowText.includes("ai:");
}

export function buildRequirementReport({
  readmeText,
  workflowText,
  hasCodemodScript,
  evaluationDocs,
  aiProofDoc,
}) {
  const migrationPicked =
    readmeText.includes("OpenZeppelin") && readmeText.toLowerCase().includes("v5");
  const codemodBuilt = hasCodemodScript && workflowText.includes("js-ast-grep:");
  const aiConfigured = isAiConfigured(workflowText);
  const aiProofExecuted = aiProofDoc?.workflow?.status === 0;

  const hasFullPassingRealRepo = evaluationDocs.some(({ doc }) =>
    hasPassingBaselineAndPost(doc),
  );
  const hasAnyNonRegressiveRealRepo = evaluationDocs.some(({ doc }) =>
    hasNonRegressiveRealRepoEvidence(doc),
  );

  const requirements = [
    {
      id: "pick_real_world_upgrade",
      text: "Pick a real world upgrade or migration",
      status: migrationPicked ? "completed" : "pending",
      evidence: migrationPicked
        ? ["README describes OpenZeppelin v5 migration scope."]
        : ["Migration scope not detected in README."],
    },
    {
      id: "build_codemods_to_automate",
      text: "Build codemods to automate it",
      status: codemodBuilt ? "completed" : "pending",
      evidence: codemodBuilt
        ? ["workflow.yaml includes js-ast-grep transform and codemod script exists."]
        : ["Codemod automation wiring appears incomplete."],
    },
    {
      id: "use_ai_for_edge_cases",
      text: "Use AI to handle edge cases",
      status: aiConfigured && aiProofExecuted ? "completed" : aiConfigured ? "partial" : "pending",
      evidence: aiConfigured
        ? aiProofExecuted
          ? ["AI workflow is configured and aiReview execution proof is present."]
          : ["AI workflow is configured, but aiReview execution proof is missing."]
        : ["AI workflow step is not configured in workflow.yaml."],
    },
    {
      id: "prove_it_works_on_real_repo",
      text: "Prove it works on a real repo",
      status: hasFullPassingRealRepo
        ? "completed"
        : hasAnyNonRegressiveRealRepo
          ? "partial"
          : "pending",
      evidence: hasFullPassingRealRepo
        ? ["At least one real repo has baseline and post-codemod compile+test passing."]
        : hasAnyNonRegressiveRealRepo
          ? ["Real repo runs exist with non-regression evidence, but full pass proof is incomplete."]
          : ["No valid real-repo evaluation summaries found."],
    },
  ];

  const scoreByStatus = { completed: 1, partial: 0.5, pending: 0 };
  const score =
    requirements.reduce((acc, req) => acc + scoreByStatus[req.status], 0) /
    requirements.length;

  return {
    generated_at: new Date().toISOString(),
    completion_percent: Math.round(score * 100),
    requirements,
  };
}

function buildUsageText() {
  return [
    "Usage:",
    "  node ./scripts/hackathon-evidence.js [--workdirs <dir1,dir2>] [--ai-proof <file>] [--output <file>]",
    "",
    "Example:",
    "  node ./scripts/hackathon-evidence.js --workdirs .codemod-eval-final,.codemod-eval --ai-proof ./.codemod-eval-final/ai-proof-summary.json --output ./.codemod-eval-final/hackathon-requirements.json",
  ].join("\n");
}

async function main() {
  const options = parseEvidenceArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${buildUsageText()}\n`);
    return;
  }

  const readmePath = path.resolve("README.md");
  const workflowPath = path.resolve("workflow.yaml");
  const codemodScriptPath = path.resolve("scripts", "codemod.ts");

  const [readmeText, workflowText] = await Promise.all([
    fs.readFile(readmePath, "utf8"),
    fs.readFile(workflowPath, "utf8"),
  ]);

  const hasCodemodScript = await pathExists(codemodScriptPath);
  const evaluationDocs = await loadEvaluationDocs(options.workdirs);
  const aiProofDoc = options.aiProof
    ? await readJsonIfExists(path.resolve(options.aiProof))
    : null;

  const report = buildRequirementReport({
    readmeText,
    workflowText,
    hasCodemodScript,
    evaluationDocs,
    aiProofDoc,
  });

  const enriched = {
    ...report,
    scanned_workdirs: options.workdirs.map((dir) => path.resolve(dir)),
    evaluation_summaries: evaluationDocs.map(({ target, summary_path, doc }) => ({
      target,
      summary_path,
      verdict: doc.verdict ?? null,
      reason: doc.reason ?? null,
    })),
    ai_proof_path: options.aiProof ? path.resolve(options.aiProof) : null,
    ai_proof_loaded: Boolean(aiProofDoc),
  };

  const outputPath = path.resolve(options.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(enriched, null, 2), "utf8");

  process.stdout.write(`Wrote hackathon requirement report: ${outputPath}\n`);
  process.stdout.write(`Completion: ${enriched.completion_percent}%\n`);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exit(1);
  });
}
