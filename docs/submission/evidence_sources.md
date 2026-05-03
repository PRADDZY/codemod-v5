# Evidence Sources

## Canonical Links
- GitHub repository: https://github.com/PRADDZY/codemod-v5
- Codemod registry: https://app.codemod.com/registry/%40praddzy/openzeppelin-v5-safe-imports
- Verification run: https://github.com/PRADDZY/codemod-v5/actions/runs/25108419160
- Live demo: https://oz-v5-live-replay-demo.dpratik3005.workers.dev
- Case study: https://dev.to/pratik_daithankar_4a5c141/openzeppelin-v5-final-case-study-116k

## Canonical Evidence Files
- docs/submission/metrics.json
- docs/submission/submission_payload.json
- docs/submission/evidence_manifest.json
- heavy-matrix-eval-slim/verdict-summary.json
- heavy-matrix-eval-slim/*/evaluation-summary.json

## Reproduction Commands
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
