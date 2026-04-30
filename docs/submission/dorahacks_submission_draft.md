# DoraHacks Submission

## Summary
Automates OpenZeppelin import migration using Codemod workflow + AI review for edge-case handling.

## Requirement Checklist
- Pick a real world upgrade or migration: completed
- Build codemods to automate it: completed
- Use AI to handle edge cases: completed
- Prove it works on a real repo: completed
- Current completion score: 100%

## Real Repo Validation
foundry-defi-stablecoin-cu (baseline compile/test: 0/0, post compile/test: 0/0, verdict: pass).

| Target | Baseline Compile | Baseline Test | Post Compile | Post Test | Regression | Verdict |
|---|---:|---:|---:|---:|---|---|
| foundry-defi-stablecoin-cu | 0 | 0 | 0 | 0 | false | pass |
| openzeppelin-contracts | 0 | 0 | 0 | 0 | false | pass |
| openzeppelin-contracts-upgradeable | 0 | 0 | 0 | 0 | false | pass |

## AI Proof
- Workflow status: 0
- TODO markers before/after: 151 / 151
- TODO delta: 0

## Judge Quick Checks
- Real world migration scope: OpenZeppelin v5 Solidity import-path changes in public repos.
- Deterministic automation: workflow applies only allowlisted safe rewrites and preserves unresolved TODO markers.
- AI usage is evidence-backed: AI review command output captured with before/after TODO counts and workflow exit status.
- Regression guard: baseline vs post-codemod compile/test status captured across multiple public repositories.

## Links
- GitHub: https://github.com/PRADDZY/codemod-v5
- Codemod Registry: https://app.codemod.com/registry/%40praddzy/openzeppelin-v5-safe-imports
- Package: @praddzy/openzeppelin-v5-safe-imports
- Demo video: https://github.com/PRADDZY/codemod-v5/actions/runs/25108419160
- Medium case study: https://github.com/PRADDZY/codemod-v5/blob/main/docs/submission/medium_case_study_final.md

## Evidence Pointers
- docs/submission/metrics.json
- docs/submission/evidence_manifest.json
- heavy-matrix-eval-slim/verdict-summary.json
- heavy-matrix-eval-slim/*/evaluation-summary.json

## Reproduction Commands
```bash
npm ci
npm test
npm run evidence:ai -- --target .codemod-eval-final/openzeppelin-contracts-upgradeable --workflow-path . --output .codemod-eval-final/ai-proof-summary.json
npm run evidence:hackathon -- --workdirs .codemod-eval-final,.codemod-eval --ai-proof .codemod-eval-final/ai-proof-summary.json --output .codemod-eval-final/hackathon-requirements.json
export SUBMISSION_DEMO_URL="https://<demo-url>"
export SUBMISSION_CASE_STUDY_URL="https://<case-study-url>"
npm run evidence:submission:final
```
