const summaryEl = document.getElementById("summary");
const scenarioListEl = document.getElementById("scenario-list");
const scenarioHeaderEl = document.getElementById("scenario-header");
const scenarioChecksEl = document.getElementById("scenario-checks");
const diffSamplesEl = document.getElementById("diff-samples");
const runCommandsEl = document.getElementById("run-commands");
const logCodemodEl = document.getElementById("log-codemod");
const logCompileBeforeEl = document.getElementById("log-compile-before");
const logCompileAfterEl = document.getElementById("log-compile-after");

let scenarios = [];
let selectedId = null;

function safe(value, fallback = "n/a") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function renderSummary(payload) {
  const items = [
    { label: "Scenarios", value: safe(payload?.summary?.scenario_count) },
    { label: "Completion", value: `${safe(payload?.summary?.completion_percent)}%` },
    { label: "AI Workflow", value: safe(payload?.summary?.ai_workflow_status) },
    { label: "TODO Before", value: safe(payload?.summary?.todo_before) },
    { label: "TODO After", value: safe(payload?.summary?.todo_after) },
  ];
  summaryEl.innerHTML = items
    .map(
      (item) => `
      <article class="stat">
        <div class="stat-label">${item.label}</div>
        <div class="stat-value">${item.value}</div>
      </article>
    `,
    )
    .join("");
}

function renderScenarioList() {
  scenarioListEl.innerHTML = scenarios
    .map((scenario) => {
      const verdictClass =
        scenario.verdict === "pass" ? "verdict-pass" : "verdict-other";
      const isActive = scenario.id === selectedId;
      return `
        <button class="scenario-item ${isActive ? "active" : ""}" data-id="${scenario.id}">
          <div class="scenario-item-title">${scenario.name}</div>
          <div class="scenario-item-meta">${scenario.repo_url}</div>
          <div class="scenario-item-meta">
            verdict: <span class="${verdictClass}">${safe(scenario.verdict)}</span> | tier: ${safe(scenario.selected_tier_mb)} MB
          </div>
        </button>
      `;
    })
    .join("");

  for (const button of scenarioListEl.querySelectorAll(".scenario-item")) {
    button.addEventListener("click", () => {
      selectedId = button.dataset.id;
      renderScenarioList();
      loadScenarioDetails(selectedId);
    });
  }
}

function renderChecks(scenario) {
  const checks = scenario.checks ?? {};
  scenarioChecksEl.innerHTML = `
    <table class="checks-table">
      <thead>
        <tr>
          <th>Check</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Baseline Compile</td><td>${safe(checks.baseline_compile)}</td></tr>
        <tr><td>Baseline Test</td><td>${safe(checks.baseline_test)}</td></tr>
        <tr><td>Post Compile</td><td>${safe(checks.post_compile)}</td></tr>
        <tr><td>Post Test</td><td>${safe(checks.post_test)}</td></tr>
        <tr><td>Regression Any</td><td>${safe(checks.regression_any)}</td></tr>
      </tbody>
    </table>
  `;
}

function renderDiffSamples(scenario) {
  const diffs = Array.isArray(scenario.diff_samples) ? scenario.diff_samples : [];
  diffSamplesEl.innerHTML = diffs
    .map(
      (diff) => `
      <article class="diff">
        <div class="diff-title">${diff.label}</div>
        <pre>// before\n${safe(diff.before, "")}\n\n// after\n${safe(diff.after, "")}</pre>
      </article>
    `,
    )
    .join("");
}

function renderHeader(scenario) {
  const todoTotal = scenario.todo_markers?.total ?? 0;
  const reason = safe(scenario.reason);
  scenarioHeaderEl.innerHTML = `
    <h2>${scenario.name}</h2>
    <p>
      repo: <a href="${scenario.repo_url}" target="_blank" rel="noreferrer">${scenario.repo_url}</a><br />
      ref: <code>${safe(scenario.ref)}</code><br />
      verdict: <strong>${safe(scenario.verdict)}</strong><br />
      reason: ${reason}<br />
      TODO markers after codemod: <strong>${todoTotal}</strong>
    </p>
  `;
}

async function loadScenarioDetails(id) {
  const response = await fetch(`/api/scenarios/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(`Failed to load scenario ${id}`);
  }
  const payload = await response.json();
  const scenario = payload.scenario;
  renderHeader(scenario);
  renderChecks(scenario);
  renderDiffSamples(scenario);
  runCommandsEl.textContent = (scenario.run_commands ?? []).join("\n");
  logCodemodEl.textContent = safe(scenario.logs?.codemod_stdout_excerpt, "");
  logCompileBeforeEl.textContent = safe(
    scenario.logs?.baseline_compile_excerpt,
    "",
  );
  logCompileAfterEl.textContent = safe(scenario.logs?.post_compile_excerpt, "");
}

async function main() {
  const response = await fetch("/api/scenarios");
  if (!response.ok) {
    throw new Error("Failed to load scenarios");
  }
  const payload = await response.json();
  scenarios = payload.scenarios ?? [];
  if (scenarios.length === 0) {
    scenarioListEl.innerHTML = "<p>No scenarios loaded.</p>";
    return;
  }
  renderSummary(payload);
  selectedId = scenarios[0].id;
  renderScenarioList();
  await loadScenarioDetails(selectedId);
}

main().catch((error) => {
  summaryEl.innerHTML = `<article class="stat"><div class="stat-label">Error</div><div class="stat-value">${error.message}</div></article>`;
});
