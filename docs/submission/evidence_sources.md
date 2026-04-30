# Evidence Sources

## Primary workflow evidence

- Heavy matrix run: https://github.com/PRADDZY/codemod-v5/actions/runs/25108419160
- Artifact API URL: https://api.github.com/repos/PRADDZY/codemod-v5/actions/artifacts/6708051921/zip
- Verify run for packaging commit: https://github.com/PRADDZY/codemod-v5/actions/runs/25117900139

## Local backup files

- `C:/Users/Pratik Daithankar/Downloads/heavy-matrix-eval.zip`
- `C:/Users/Pratik Daithankar/Downloads/logs_66702329523.zip`

## Reproduction commands

```bash
npm ci
npm test
npm run evidence:ai -- --target .codemod-eval-final/openzeppelin-contracts-upgradeable --workflow-path . --output .codemod-eval-final/ai-proof-summary.json
npm run evidence:hackathon -- --workdirs .codemod-eval-final,.codemod-eval --ai-proof .codemod-eval-final/ai-proof-summary.json --output .codemod-eval-final/hackathon-requirements.json
node ./scripts/submission-pack.js --workdirs heavy-matrix-eval-slim --requirements ./.codemod-eval-final/hackathon-requirements.json --ai-proof ./.codemod-eval-final/ai-proof-summary.json --output-dir ./docs/submission --strict-links --demo-url https://github.com/PRADDZY/codemod-v5/actions/runs/25108419160 --case-study-url https://github.com/PRADDZY/codemod-v5/blob/main/docs/submission/medium_case_study_final.md
```

