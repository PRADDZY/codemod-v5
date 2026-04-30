# Submission Differentiation Notes

## Comparison Matrix
| Judge Check | Weak Submission Pattern | This Submission Evidence |
|---|---|---|
| Real migration scope | Toy sample only | OpenZeppelin v5 import migration tested on public repos (`heavy-matrix-eval-slim/*/evaluation-summary.json`) |
| Deterministic codemod behavior | Broad AI-only patching | Allowlisted safe rewrites + explicit unresolved TODO markers (`workflow.yaml`, `migration-report.json`) |
| AI edge-case handling | AI mentioned without measurable output | AI proof JSON with workflow exit status and TODO counts (`.codemod-eval-final/ai-proof-summary.json`) |
| Regression control | No baseline/post comparison | Baseline vs post compile/test table in `dorahacks_submission_final.md` and metrics JSON |
| Reproducibility | Missing run commands | Full command chain in `README.md` and `docs/submission/evidence_sources.md` |

## Baseline vs Post Snapshot
| Target | Baseline Compile | Baseline Test | Post Compile | Post Test | Regression | Verdict |
|---|---:|---:|---:|---:|---|---|
| foundry-defi-stablecoin-cu | 0 | 0 | 0 | 0 | false | pass |
| openzeppelin-contracts | 0 | 0 | 0 | 0 | false | pass |
| openzeppelin-contracts-upgradeable | 0 | 0 | 0 | 0 | false | pass |
