# Demo Runbook

1. Show target repo state before codemod (imports and test baseline summary).
2. Run workflow with explicit target path.
3. Show generated migration report and AI proof summary.
4. Run compile/test evidence command.
5. Open `submission-pack/dorahacks_submission_draft.md` and highlight requirement mapping.

Suggested terminal sequence:
```bash
npm test
npm run evidence:ai -- --target .codemod-eval-final/openzeppelin-contracts-upgradeable --workflow-path . --output .codemod-eval-final/ai-proof-summary.json
npm run evidence:hackathon -- --workdirs .codemod-eval-final,.codemod-eval --ai-proof .codemod-eval-final/ai-proof-summary.json --output .codemod-eval-final/hackathon-requirements.json
npm run evidence:submission
```
