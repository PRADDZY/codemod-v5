# Demo Runbook

1. Show target repo state before codemod (imports and test baseline summary).
2. Run workflow with explicit target path.
3. Show generated migration report and AI proof summary.
4. Run compile/test evidence command.
5. Open `docs/submission/dorahacks_submission_final.md` and highlight requirement mapping.

Suggested terminal sequence:
```bash
npm test
npm run evidence:ai -- --target .codemod-eval-final/openzeppelin-contracts-upgradeable --workflow-path . --output .codemod-eval-final/ai-proof-summary.json
npm run evidence:hackathon -- --workdirs .codemod-eval-final,.codemod-eval --ai-proof .codemod-eval-final/ai-proof-summary.json --output .codemod-eval-final/hackathon-requirements.json
export SUBMISSION_DEMO_URL="https://github.com/PRADDZY/codemod-v5/actions/runs/25108419160"
export SUBMISSION_LIVE_DEMO_URL="https://oz-v5-live-replay-demo.dpratik3005.workers.dev"
export SUBMISSION_CASE_STUDY_URL="https://dev.to/pratik_daithankar_4a5c141/openzeppelin-v5-final-case-study-116k"
npm run evidence:submission:final
```
