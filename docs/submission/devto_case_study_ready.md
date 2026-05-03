# OpenZeppelin v5 Migration with Deterministic Codemods + AI Edge-Case Review

## Problem
OpenZeppelin v5 migration creates repetitive import and symbol updates across Solidity repos. The slow part is safe bulk rewrites without regressions.

## What We Built
- Deterministic codemod workflow for allowlisted safe rewrites.
- AI review path for unresolved TODO categories.
- Baseline vs post-codemod verification across real public repositories.

## Deterministic Rewrite Examples
- `@openzeppelin/contracts/security/ReentrancyGuard.sol` -> `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/security/Pausable.sol` -> `@openzeppelin/contracts/utils/Pausable.sol`
- `IERC20Upgradeable` -> `IERC20` when paired with safe import migration

## Real Repo Evidence
| Target | Baseline Compile | Baseline Test | Post Compile | Post Test | Regression | Verdict |
|---|---:|---:|---:|---:|---|---|
| foundry-defi-stablecoin-cu | 0 | 0 | 0 | 0 | false | pass |
| openzeppelin-contracts | 0 | 0 | 0 | 0 | false | pass |
| openzeppelin-contracts-upgradeable | 0 | 0 | 0 | 0 | false | pass |

## AI Edge-Case Evidence
- Workflow status: 0
- TODO markers before/after: 151 / 151
- TODO delta: 0

## Reproduce
```bash
npm ci
npm test
npm run evidence:ai -- --target .codemod-eval-final/openzeppelin-contracts-upgradeable --workflow-path . --output .codemod-eval-final/ai-proof-summary.json
npm run evidence:hackathon -- --workdirs .codemod-eval-final,.codemod-eval --ai-proof .codemod-eval-final/ai-proof-summary.json --output .codemod-eval-final/hackathon-requirements.json
export SUBMISSION_DEMO_URL="https://github.com/PRADDZY/codemod-v5/actions/runs/25108419160"
export SUBMISSION_LIVE_DEMO_URL="https://oz-v5-live-replay-demo.dpratik3005.workers.dev"
export SUBMISSION_CASE_STUDY_URL="https://dev.to/pratik_daithankar_4a5c141/openzeppelin-v5-final-case-study-116k"
npm run evidence:submission:final
```

## Links
- GitHub: https://github.com/PRADDZY/codemod-v5
- Registry: https://app.codemod.com/registry/%40praddzy/openzeppelin-v5-safe-imports
- Verification run: https://github.com/PRADDZY/codemod-v5/actions/runs/25108419160
- Live demo: https://oz-v5-live-replay-demo.dpratik3005.workers.dev
- Case study: https://dev.to/pratik_daithankar_4a5c141/openzeppelin-v5-final-case-study-116k
