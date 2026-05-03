#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_WORKDIRS = [".codemod-eval-final", ".codemod-eval"];
const DEFAULT_REQUIREMENTS = ".codemod-eval-final/hackathon-requirements.json";
const DEFAULT_AI_PROOF = ".codemod-eval-final/ai-proof-summary.json";
const DEFAULT_OUTPUT_DIR = ".codemod-eval-final/submission-pack";
const DEFAULT_REPO_URL = "https://github.com/PRADDZY/codemod-v5";
const DEFAULT_REGISTRY_URL =
  "https://app.codemod.com/registry/%40praddzy/openzeppelin-v5-safe-imports";
const DEFAULT_PACKAGE_NAME = "@praddzy/openzeppelin-v5-safe-imports";
const DEFAULT_DEMO_URL = "";
const DEFAULT_LIVE_DEMO_URL = "";
const DEFAULT_CASE_STUDY_URL = "";

export function parseSubmissionPackArgs(argv) {
  const options = {
    workdirs: [...DEFAULT_WORKDIRS],
    requirements: DEFAULT_REQUIREMENTS,
    aiProof: DEFAULT_AI_PROOF,
    outputDir: DEFAULT_OUTPUT_DIR,
    repoUrl: DEFAULT_REPO_URL,
    registryUrl: DEFAULT_REGISTRY_URL,
    packageName: DEFAULT_PACKAGE_NAME,
    demoUrl: process.env.SUBMISSION_DEMO_URL ?? DEFAULT_DEMO_URL,
    liveDemoUrl:
      process.env.SUBMISSION_LIVE_DEMO_URL ?? DEFAULT_LIVE_DEMO_URL,
    caseStudyUrl:
      process.env.SUBMISSION_CASE_STUDY_URL ?? DEFAULT_CASE_STUDY_URL,
    strictLinks: false,
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
    if (current === "--requirements") {
      options.requirements = argv[index + 1] ?? DEFAULT_REQUIREMENTS;
      index += 1;
      continue;
    }
    if (current === "--ai-proof") {
      options.aiProof = argv[index + 1] ?? DEFAULT_AI_PROOF;
      index += 1;
      continue;
    }
    if (current === "--output-dir") {
      options.outputDir = argv[index + 1] ?? DEFAULT_OUTPUT_DIR;
      index += 1;
      continue;
    }
    if (current === "--repo-url") {
      options.repoUrl = argv[index + 1] ?? DEFAULT_REPO_URL;
      index += 1;
      continue;
    }
    if (current === "--registry-url") {
      options.registryUrl = argv[index + 1] ?? DEFAULT_REGISTRY_URL;
      index += 1;
      continue;
    }
    if (current === "--package-name") {
      options.packageName = argv[index + 1] ?? DEFAULT_PACKAGE_NAME;
      index += 1;
      continue;
    }
    if (current === "--demo-url") {
      options.demoUrl = argv[index + 1] ?? DEFAULT_DEMO_URL;
      index += 1;
      continue;
    }
    if (current === "--live-demo-url") {
      options.liveDemoUrl = argv[index + 1] ?? DEFAULT_LIVE_DEMO_URL;
      index += 1;
      continue;
    }
    if (current === "--case-study-url") {
      options.caseStudyUrl = argv[index + 1] ?? DEFAULT_CASE_STUDY_URL;
      index += 1;
      continue;
    }
    if (current === "--strict-links") {
      options.strictLinks = true;
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

function commandStatus(summary, section, key) {
  const value = summary?.[section]?.[key]?.status;
  return typeof value === "number" ? value : null;
}

export function isValidHttpUrl(input) {
  if (typeof input !== "string" || input.trim().length === 0) {
    return false;
  }
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function ensureRequiredLinks({
  strictLinks,
  demoUrl,
  liveDemoUrl,
  caseStudyUrl,
}) {
  if (!strictLinks) {
    return;
  }
  if (!isValidHttpUrl(demoUrl)) {
    throw new Error(
      "Missing or invalid demo URL. Provide --demo-url (or SUBMISSION_DEMO_URL).",
    );
  }
  if (!isValidHttpUrl(liveDemoUrl)) {
    throw new Error(
      "Missing or invalid live demo URL. Provide --live-demo-url (or SUBMISSION_LIVE_DEMO_URL).",
    );
  }
  if (!isValidHttpUrl(caseStudyUrl)) {
    throw new Error(
      "Missing or invalid case-study URL. Provide --case-study-url (or SUBMISSION_CASE_STUDY_URL).",
    );
  }
}

function toPortablePath(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function toRepoRelativePath(inputPath) {
  const absolute = path.resolve(inputPath);
  const relative = path.relative(process.cwd(), absolute);
  return toPortablePath(relative || ".");
}

export function summarizeEvaluationDoc({ target, summaryPath, doc }) {
  return {
    target,
    summary_path: toRepoRelativePath(summaryPath),
    repo_url: doc?.repo_url ?? null,
    ref: doc?.ref ?? null,
    baseline_compile: commandStatus(doc, "baseline", "compile"),
    baseline_test: commandStatus(doc, "baseline", "test"),
    post_compile: commandStatus(doc, "post_codemod", "compile"),
    post_test: commandStatus(doc, "post_codemod", "test"),
    regression_any:
      typeof doc?.regression?.any === "boolean" ? doc.regression.any : null,
    verdict: doc?.verdict ?? null,
    reason: doc?.reason ?? null,
    selected_tier_mb: doc?.selected_tier_mb ?? null,
  };
}

function hasAnyChecks(entry) {
  return (
    typeof entry.baseline_compile === "number" ||
    typeof entry.baseline_test === "number" ||
    typeof entry.post_compile === "number" ||
    typeof entry.post_test === "number"
  );
}

function isFullPass(entry) {
  return (
    entry.baseline_compile === 0 &&
    entry.baseline_test === 0 &&
    entry.post_compile === 0 &&
    entry.post_test === 0 &&
    entry.regression_any !== true
  );
}

function isNonRegressive(entry) {
  return hasAnyChecks(entry) && entry.regression_any !== true;
}

export function pickPrimaryEvidence(evaluations) {
  const fullPass = evaluations.find((entry) => isFullPass(entry));
  if (fullPass) {
    return fullPass;
  }
  return evaluations.find((entry) => isNonRegressive(entry)) ?? null;
}

function mapRequirementStatuses(requirementsDoc) {
  const mapped = {
    pick_real_world_upgrade: "pending",
    build_codemods_to_automate: "pending",
    use_ai_for_edge_cases: "pending",
    prove_it_works_on_real_repo: "pending",
  };
  for (const item of requirementsDoc?.requirements ?? []) {
    if (item?.id in mapped) {
      mapped[item.id] = item.status ?? "pending";
    }
  }
  return mapped;
}

export function buildMetrics({
  requirementsDoc,
  aiProofDoc,
  evaluations,
  links,
}) {
  const beforeTodos = aiProofDoc?.before_todos?.total ?? null;
  const afterTodos = aiProofDoc?.after_todos?.total ?? null;
  const todoDelta =
    typeof beforeTodos === "number" && typeof afterTodos === "number"
      ? afterTodos - beforeTodos
      : null;

  return {
    generated_at: new Date().toISOString(),
    hackathon_completion_percent: requirementsDoc?.completion_percent ?? 0,
    requirement_statuses: mapRequirementStatuses(requirementsDoc),
    ai_proof: {
      workflow_status: aiProofDoc?.workflow?.status ?? null,
      todo_before: beforeTodos,
      todo_after: afterTodos,
      todo_delta: todoDelta,
      scanned_files: aiProofDoc?.before_todos?.scanned_files ?? null,
    },
    real_repo_evidence: evaluations,
    links,
  };
}

function displayStatus(value) {
  return typeof value === "number" ? String(value) : "n/a";
}

function renderEvidenceTable(evaluations) {
  const header = [
    "| Target | Baseline Compile | Baseline Test | Post Compile | Post Test | Regression | Verdict |",
    "|---|---:|---:|---:|---:|---|---|",
  ];
  const rows = evaluations.map((entry) => {
    const regression =
      typeof entry.regression_any === "boolean"
        ? String(entry.regression_any)
        : "n/a";
    const verdict = entry.verdict ?? "n/a";
    return `| ${entry.target} | ${displayStatus(entry.baseline_compile)} | ${displayStatus(
      entry.baseline_test,
    )} | ${displayStatus(entry.post_compile)} | ${displayStatus(
      entry.post_test,
    )} | ${regression} | ${verdict} |`;
  });
  return [...header, ...rows].join("\n");
}

function buildDoraDraft({ metrics, primaryEvidence }) {
  const status = metrics.requirement_statuses;
  const primaryLine = primaryEvidence
    ? `${primaryEvidence.target} (baseline compile/test: ${displayStatus(
        primaryEvidence.baseline_compile,
      )}/${displayStatus(primaryEvidence.baseline_test)}, post compile/test: ${displayStatus(
        primaryEvidence.post_compile,
      )}/${displayStatus(primaryEvidence.post_test)}, verdict: ${
        primaryEvidence.verdict ?? "n/a"
      }).`
    : "No evaluation summary loaded. Run evaluation first.";

  return [
    "# DoraHacks Submission",
    "",
    "## Summary",
    "Automates OpenZeppelin import migration using Codemod workflow + AI review for edge-case handling.",
    "",
    "## Requirement Checklist",
    `- Pick a real world upgrade or migration: ${status.pick_real_world_upgrade}`,
    `- Build codemods to automate it: ${status.build_codemods_to_automate}`,
    `- Use AI to handle edge cases: ${status.use_ai_for_edge_cases}`,
    `- Prove it works on a real repo: ${status.prove_it_works_on_real_repo}`,
    `- Current completion score: ${metrics.hackathon_completion_percent}%`,
    "",
    "## Real Repo Validation",
    primaryLine,
    "",
    renderEvidenceTable(metrics.real_repo_evidence),
    "",
    "## AI Proof",
    `- Workflow status: ${metrics.ai_proof.workflow_status ?? "n/a"}`,
    `- TODO markers before/after: ${metrics.ai_proof.todo_before ?? "n/a"} / ${
      metrics.ai_proof.todo_after ?? "n/a"
    }`,
    `- TODO delta: ${metrics.ai_proof.todo_delta ?? "n/a"}`,
    "",
    "## Judge Quick Checks",
    "- Real world migration scope: OpenZeppelin v5 Solidity import-path changes in public repos.",
    "- Deterministic automation: workflow applies only allowlisted safe rewrites and preserves unresolved TODO markers.",
    "- AI usage is evidence-backed: AI review command output captured with before/after TODO counts and workflow exit status.",
    "- Regression guard: baseline vs post-codemod compile/test status captured across multiple public repositories.",
    "",
    "## Links",
    `- GitHub: ${metrics.links.github_repo}`,
    `- Codemod Registry: ${metrics.links.codemod_registry}`,
    `- Package: ${metrics.links.package_name}`,
    `- Demo video: ${metrics.links.demo_video_url ?? "not provided"}`,
    `- Live demo: ${metrics.links.live_demo_url ?? "not provided"}`,
    `- Case study: ${metrics.links.case_study_url ?? "not provided"}`,
    "",
    "## Evidence Pointers",
    "- docs/submission/metrics.json",
    "- docs/submission/evidence_manifest.json",
    "- heavy-matrix-eval-slim/verdict-summary.json",
    "- heavy-matrix-eval-slim/*/evaluation-summary.json",
    "",
    "## Reproduction Commands",
    "```bash",
    "npm ci",
    "npm test",
    "npm run evidence:ai -- --target .codemod-eval-final/openzeppelin-contracts-upgradeable --workflow-path . --output .codemod-eval-final/ai-proof-summary.json",
    "npm run evidence:hackathon -- --workdirs .codemod-eval-final,.codemod-eval --ai-proof .codemod-eval-final/ai-proof-summary.json --output .codemod-eval-final/hackathon-requirements.json",
    "export SUBMISSION_DEMO_URL=\"https://<demo-url>\"",
    "export SUBMISSION_LIVE_DEMO_URL=\"https://<live-demo-url>\"",
    "export SUBMISSION_CASE_STUDY_URL=\"https://<case-study-url>\"",
    "npm run evidence:submission:final",
    "```",
    "",
  ].join("\n");
}

function buildMediumDraft(metrics) {
  const primary = pickPrimaryEvidence(metrics.real_repo_evidence);
  return [
    "# Case Study Draft",
    "",
    "## Problem",
    "Teams upgrading Solidity repos to OpenZeppelin v5 spend time on repetitive import rewrites and manual triage.",
    "",
    "## Approach",
    "Built a codemod workflow that applies deterministic import updates, then runs AI review for unresolved patterns.",
    "",
    "## Implementation",
    "1. JS AST codemod for safe import migration.",
    "2. AI review pass controlled by workflow params.",
    "3. Evaluation harness for baseline vs post-codemod compile/test checks.",
    "",
    "## Evidence",
    `- Requirement completion score: ${metrics.hackathon_completion_percent}%`,
    `- AI workflow status: ${metrics.ai_proof.workflow_status ?? "n/a"}`,
    `- Real-repo summaries captured: ${metrics.real_repo_evidence.length}`,
    "",
    "## Results",
    primary
      ? `Primary run: ${primary.target} with baseline compile/test ${displayStatus(
          primary.baseline_compile,
        )}/${displayStatus(primary.baseline_test)} and post-codemod compile/test ${displayStatus(
          primary.post_compile,
        )}/${displayStatus(primary.post_test)} (verdict: ${
          primary.verdict ?? "n/a"
        }).`
      : "No primary run selected.",
    "",
    "## Demo",
    `Demo link: ${metrics.links.demo_video_url ?? "not provided"}`,
    `Live demo link: ${metrics.links.live_demo_url ?? "not provided"}`,
    "",
  ].join("\n");
}

function buildDevtoCaseStudy(metrics) {
  return [
    "# OpenZeppelin v5 Migration with Deterministic Codemods + AI Edge-Case Review",
    "",
    "## Problem",
    "OpenZeppelin v5 migration creates repetitive import and symbol updates across Solidity repos. The slow part is safe bulk rewrites without regressions.",
    "",
    "## What We Built",
    "- Deterministic codemod workflow for allowlisted safe rewrites.",
    "- AI review path for unresolved TODO categories.",
    "- Baseline vs post-codemod verification across real public repositories.",
    "",
    "## Deterministic Rewrite Examples",
    "- `@openzeppelin/contracts/security/ReentrancyGuard.sol` -> `@openzeppelin/contracts/utils/ReentrancyGuard.sol`",
    "- `@openzeppelin/contracts/security/Pausable.sol` -> `@openzeppelin/contracts/utils/Pausable.sol`",
    "- `IERC20Upgradeable` -> `IERC20` when paired with safe import migration",
    "",
    "## Real Repo Evidence",
    renderEvidenceTable(metrics.real_repo_evidence),
    "",
    "## AI Edge-Case Evidence",
    `- Workflow status: ${metrics.ai_proof.workflow_status ?? "n/a"}`,
    `- TODO markers before/after: ${metrics.ai_proof.todo_before ?? "n/a"} / ${
      metrics.ai_proof.todo_after ?? "n/a"
    }`,
    `- TODO delta: ${metrics.ai_proof.todo_delta ?? "n/a"}`,
    "",
    "## Reproduce",
    "```bash",
    "npm ci",
    "npm test",
    "npm run evidence:ai -- --target .codemod-eval-final/openzeppelin-contracts-upgradeable --workflow-path . --output .codemod-eval-final/ai-proof-summary.json",
    "npm run evidence:hackathon -- --workdirs .codemod-eval-final,.codemod-eval --ai-proof .codemod-eval-final/ai-proof-summary.json --output .codemod-eval-final/hackathon-requirements.json",
    "export SUBMISSION_DEMO_URL=\"https://<demo-url>\"",
    "export SUBMISSION_LIVE_DEMO_URL=\"https://<live-demo-url>\"",
    "export SUBMISSION_CASE_STUDY_URL=\"https://<case-study-url>\"",
    "npm run evidence:submission:final",
    "```",
    "",
    "## Links",
    `- GitHub: ${metrics.links.github_repo}`,
    `- Registry: ${metrics.links.codemod_registry}`,
    `- Demo video: ${metrics.links.demo_video_url ?? "not provided"}`,
    `- Live demo: ${metrics.links.live_demo_url ?? "not provided"}`,
    "",
  ].join("\n");
}

function buildDemoRunbook() {
  return [
    "# Demo Runbook",
    "",
    "1. Show target repo state before codemod (imports and test baseline summary).",
    "2. Run workflow with explicit target path.",
    "3. Show generated migration report and AI proof summary.",
    "4. Run compile/test evidence command.",
    "5. Open `docs/submission/dorahacks_submission_final.md` and highlight requirement mapping.",
    "",
    "Suggested terminal sequence:",
    "```bash",
    "npm test",
    "npm run evidence:ai -- --target .codemod-eval-final/openzeppelin-contracts-upgradeable --workflow-path . --output .codemod-eval-final/ai-proof-summary.json",
    "npm run evidence:hackathon -- --workdirs .codemod-eval-final,.codemod-eval --ai-proof .codemod-eval-final/ai-proof-summary.json --output .codemod-eval-final/hackathon-requirements.json",
    "export SUBMISSION_DEMO_URL=\"https://<demo-url>\"",
    "export SUBMISSION_LIVE_DEMO_URL=\"https://<live-demo-url>\"",
    "export SUBMISSION_CASE_STUDY_URL=\"https://<case-study-url>\"",
    "npm run evidence:submission:final",
    "```",
    "",
  ].join("\n");
}

function buildCompetitorGapNotes(metrics) {
  const evidenceRows = metrics.real_repo_evidence
    .map(
      (entry) =>
        `| ${entry.target} | ${displayStatus(entry.baseline_compile)} | ${displayStatus(
          entry.baseline_test,
        )} | ${displayStatus(entry.post_compile)} | ${displayStatus(
          entry.post_test,
        )} | ${entry.regression_any === true ? "true" : "false"} | ${
          entry.verdict ?? "n/a"
        } |`,
    )
    .join("\n");

  return [
    "# Submission Differentiation Notes",
    "",
    "## Comparison Matrix",
    "| Judge Check | Weak Submission Pattern | This Submission Evidence |",
    "|---|---|---|",
    "| Real migration scope | Toy sample only | OpenZeppelin v5 import migration tested on public repos (`heavy-matrix-eval-slim/*/evaluation-summary.json`) |",
    "| Deterministic codemod behavior | Broad AI-only patching | Allowlisted safe rewrites + explicit unresolved TODO markers (`workflow.yaml`, `migration-report.json`) |",
    "| AI edge-case handling | AI mentioned without measurable output | AI proof JSON with workflow exit status and TODO counts (`.codemod-eval-final/ai-proof-summary.json`) |",
    "| Regression control | No baseline/post comparison | Baseline vs post compile/test table in `dorahacks_submission_final.md` and metrics JSON |",
    "| Reproducibility | Missing run commands | Full command chain in `README.md` and `docs/submission/evidence_sources.md` |",
    "",
    "## Baseline vs Post Snapshot",
    "| Target | Baseline Compile | Baseline Test | Post Compile | Post Test | Regression | Verdict |",
    "|---|---:|---:|---:|---:|---|---|",
    evidenceRows,
    "",
  ].join("\n");
}

function buildEvidenceSources(metrics) {
  const reproDemo =
    metrics.links.demo_video_url ??
    "https://github.com/PRADDZY/codemod-v5/actions";
  const liveDemo = metrics.links.live_demo_url ?? "https://<your-live-demo-url>";
  const reproCaseStudy =
    metrics.links.case_study_url ??
    "https://github.com/PRADDZY/codemod-v5/blob/main/docs/submission/medium_case_study_final.md";
  return [
    "# Evidence Sources",
    "",
    "## Canonical Links",
    `- GitHub repository: ${metrics.links.github_repo}`,
    `- Codemod registry: ${metrics.links.codemod_registry}`,
    `- Demo video: ${reproDemo}`,
    `- Live demo: ${liveDemo}`,
    `- Case study: ${reproCaseStudy}`,
    "",
    "## Canonical Evidence Files",
    "- docs/submission/metrics.json",
    "- docs/submission/submission_payload.json",
    "- docs/submission/evidence_manifest.json",
    "- heavy-matrix-eval-slim/verdict-summary.json",
    "- heavy-matrix-eval-slim/*/evaluation-summary.json",
    "",
    "## Reproduction Commands",
    "```bash",
    "npm ci",
    "npm test",
    "npm run evidence:ai -- --target .codemod-eval-final/openzeppelin-contracts-upgradeable --workflow-path . --output .codemod-eval-final/ai-proof-summary.json",
    "npm run evidence:hackathon -- --workdirs .codemod-eval-final,.codemod-eval --ai-proof .codemod-eval-final/ai-proof-summary.json --output .codemod-eval-final/hackathon-requirements.json",
    "export SUBMISSION_DEMO_URL=\"https://<demo-url>\"",
    "export SUBMISSION_LIVE_DEMO_URL=\"https://<live-demo-url>\"",
    "export SUBMISSION_CASE_STUDY_URL=\"https://<case-study-url>\"",
    "npm run evidence:submission:final",
    "```",
    "",
  ].join("\n");
}

function buildDoraFormPayload(metrics) {
  const primary = pickPrimaryEvidence(metrics.real_repo_evidence);
  return [
    "# DoraHacks Form Payload",
    "",
    "## Title",
    "OpenZeppelin v5 Safe Imports Codemod",
    "",
    "## One-liner",
    "Codemod + AI workflow that automates OpenZeppelin Solidity import migration with real-repo evidence.",
    "",
    "## Core links",
    `- GitHub: ${metrics.links.github_repo}`,
    `- Registry: ${metrics.links.codemod_registry}`,
    `- Demo video: ${metrics.links.demo_video_url ?? "not provided"}`,
    `- Live demo: ${metrics.links.live_demo_url ?? "not provided"}`,
    `- Case study: ${metrics.links.case_study_url ?? "not provided"}`,
    "",
    "## Proof summary",
    `- Requirement completion: ${metrics.hackathon_completion_percent}%`,
    `- AI workflow status: ${metrics.ai_proof.workflow_status ?? "n/a"}`,
    `- TODO before/after: ${metrics.ai_proof.todo_before ?? "n/a"} / ${
      metrics.ai_proof.todo_after ?? "n/a"
    }`,
    `- Primary validation target: ${primary?.target ?? "n/a"}`,
    "",
    "## Evidence files",
    "- metrics.json",
    "- dorahacks_submission_final.md",
    "- devto_case_study_ready.md",
    "- evidence_sources.md",
    "- evidence_manifest.json",
    "",
  ].join("\n");
}

function buildFinalChecklist(metrics) {
  const status = metrics.requirement_statuses;
  const hasDemo = Boolean(metrics.links.demo_video_url);
  const hasLiveDemo = Boolean(metrics.links.live_demo_url);
  const hasCaseStudy = Boolean(metrics.links.case_study_url);
  return [
    "# Final Submission Checklist",
    "",
    `- [${status.pick_real_world_upgrade === "completed" ? "x" : " "}] Real migration selected`,
    `- [${status.build_codemods_to_automate === "completed" ? "x" : " "}] Codemod automation implemented`,
    `- [${status.use_ai_for_edge_cases === "completed" ? "x" : " "}] AI edge-case flow included`,
    `- [${status.prove_it_works_on_real_repo === "completed" ? "x" : " "}] Real repo proof included`,
    `- [${metrics.ai_proof.workflow_status === 0 ? "x" : " "}] AI proof workflow status is passing`,
    `- [${hasDemo ? "x" : " "}] Public demo video URL attached`,
    `- [${hasLiveDemo ? "x" : " "}] Public live demo URL attached`,
    `- [${hasCaseStudy ? "x" : " "}] Public case-study URL attached`,
    "",
    "Deadline reference from saved DoraHacks page: 2026-05-03 18:30 (submission close).",
    "",
  ].join("\n");
}

function buildDemoScript90s() {
  return [
    "# 90s Demo Script",
    "",
    "0-15s: show target repository baseline compile/test summary.",
    "15-35s: run codemod workflow and show changed imports plus TODO markers.",
    "35-55s: run AI proof + requirement evidence commands.",
    "55-75s: show real-repo verdict table and zero-regression outcomes.",
    "75-90s: open final checklist and submission payload files.",
    "",
  ].join("\n");
}

function buildSubmissionPayload({ metrics }) {
  return {
    generated_at: new Date().toISOString(),
    summary: {
      title: "OpenZeppelin v5 Safe Imports Codemod",
      one_liner:
        "Codemod + AI workflow that automates OpenZeppelin Solidity import migration with real-repo evidence.",
      completion_percent: metrics.hackathon_completion_percent,
    },
    links: metrics.links,
    evidence: {
      ai_workflow_status: metrics.ai_proof.workflow_status,
      todo_before: metrics.ai_proof.todo_before,
      todo_after: metrics.ai_proof.todo_after,
      repositories: metrics.real_repo_evidence,
    },
    assets: {
      dorahacks_submission_markdown: "dorahacks_submission_draft.md",
      medium_case_study_markdown: "medium_case_study_draft.md",
      demo_runbook_markdown: "demo_runbook.md",
      competitor_gap_notes_markdown: "competitor_gap_notes.md",
      dorahacks_submission_final_markdown: "dorahacks_submission_final.md",
      medium_case_study_final_markdown: "medium_case_study_final.md",
      dorahacks_form_payload_markdown: "dorahacks_form_payload.md",
      demo_script_markdown: "demo_script_90s.md",
      final_checklist_markdown: "final_checklist.md",
      evidence_manifest_json: "evidence_manifest.json",
      evidence_sources_markdown: "evidence_sources.md",
      metrics_json: "metrics.json",
      devto_case_study_markdown: "devto_case_study_ready.md",
    },
  };
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
      if (!doc) {
        continue;
      }
      docs.push({ target: entry.name, summaryPath, doc });
    }
  }
  return docs;
}

function buildUsageText() {
  return [
    "Usage:",
    "  node ./scripts/submission-pack.js [--workdirs <dir1,dir2>] [--requirements <file>] [--ai-proof <file>] [--output-dir <dir>] [--demo-url <url>] [--live-demo-url <url>] [--case-study-url <url>] [--strict-links]",
    "",
    "Example:",
    "  node ./scripts/submission-pack.js --workdirs .codemod-eval-final,.codemod-eval --requirements ./.codemod-eval-final/hackathon-requirements.json --ai-proof ./.codemod-eval-final/ai-proof-summary.json --output-dir ./docs/submission --strict-links --demo-url https://example.com/demo --live-demo-url https://example.com/live --case-study-url https://example.com/case-study",
  ].join("\n");
}

async function main() {
  const options = parseSubmissionPackArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${buildUsageText()}\n`);
    return;
  }

  const requirementsDoc = await readJsonIfExists(path.resolve(options.requirements));
  const aiProofDoc = await readJsonIfExists(path.resolve(options.aiProof));
  const loadedDocs = await loadEvaluationDocs(options.workdirs);
  const evaluations = loadedDocs.map((entry) => summarizeEvaluationDoc(entry));
  const primaryEvidence = pickPrimaryEvidence(evaluations);
  ensureRequiredLinks(options);

  const links = {
    github_repo: options.repoUrl,
    codemod_registry: options.registryUrl,
    package_name: options.packageName,
    demo_video_url: options.demoUrl || null,
    live_demo_url: options.liveDemoUrl || null,
    case_study_url: options.caseStudyUrl || null,
  };
  const metrics = buildMetrics({
    requirementsDoc,
    aiProofDoc,
    evaluations,
    links,
  });

  const payload = buildSubmissionPayload({ metrics });

  const outputDir = path.resolve(options.outputDir);
  await fs.mkdir(outputDir, { recursive: true });

  const files = [
    {
      name: "metrics.json",
      content: JSON.stringify(metrics, null, 2),
    },
    {
      name: "dorahacks_submission_draft.md",
      content: buildDoraDraft({ metrics, primaryEvidence }),
    },
    {
      name: "dorahacks_submission_final.md",
      content: buildDoraDraft({ metrics, primaryEvidence }),
    },
    {
      name: "medium_case_study_draft.md",
      content: buildMediumDraft(metrics),
    },
    {
      name: "medium_case_study_final.md",
      content: buildMediumDraft(metrics),
    },
    {
      name: "devto_case_study_ready.md",
      content: buildDevtoCaseStudy(metrics),
    },
    {
      name: "demo_runbook.md",
      content: buildDemoRunbook(),
    },
    {
      name: "demo_script_90s.md",
      content: buildDemoScript90s(),
    },
    {
      name: "competitor_gap_notes.md",
      content: buildCompetitorGapNotes(metrics),
    },
    {
      name: "dorahacks_form_payload.md",
      content: buildDoraFormPayload(metrics),
    },
    {
      name: "final_checklist.md",
      content: buildFinalChecklist(metrics),
    },
    {
      name: "submission_payload.json",
      content: JSON.stringify(payload, null, 2),
    },
    {
      name: "evidence_sources.md",
      content: buildEvidenceSources(metrics),
    },
  ];

  for (const file of files) {
    await fs.writeFile(path.join(outputDir, file.name), file.content, "utf8");
  }

  process.stdout.write(`Wrote submission pack: ${outputDir}\n`);
  process.stdout.write(
    `Primary evidence: ${primaryEvidence ? primaryEvidence.target : "n/a"}\n`,
  );
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
