# Evidence Sources

## Canonical Links
- GitHub repository: https://github.com/PRADDZY/codemod-v5
- Codemod registry: https://app.codemod.com/registry/%40praddzy/openzeppelin-v5-safe-imports
- Demo video: https://github.com/PRADDZY/codemod-v5/actions/runs/25108419160
- Case study: https://github.com/PRADDZY/codemod-v5/blob/main/docs/submission/medium_case_study_final.md

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
export SUBMISSION_DEMO_URL="https://<demo-url>"
export SUBMISSION_CASE_STUDY_URL="https://<case-study-url>"
npm run evidence:submission:final
```
