# OpenZeppelin v5 Safe Imports

Focused Codemod workflow for Solidity repositories upgrading toward OpenZeppelin Contracts v5.

It handles the import-path and allowlisted symbol changes that are mechanical, then leaves categorized `OZ-V5-TODO[...]` markers where local review is still required.

## Run

Preview changes:

```bash
npx codemod@latest workflow run -w . -t /path/to/repo --no-interactive --allow-dirty --allow-fs --dry-run
```

Apply changes:

```bash
npx codemod@latest workflow run -w . -t /path/to/repo --no-interactive --allow-dirty --allow-fs
```

Optional AI follow-up for unresolved TODOs:

```bash
npx codemod@latest workflow run -w . -t /path/to/repo --no-interactive --allow-dirty --allow-fs --param aiReview=true
```

Quick path (run in under a minute on a prepared repo):

```bash
npx codemod@latest workflow run -w . -t /path/to/repo --no-interactive --allow-dirty --allow-fs --dry-run
npx codemod@latest workflow run -w . -t /path/to/repo --no-interactive --allow-dirty --allow-fs
```

## Coverage

- Safe import moves:
  - `@openzeppelin/contracts/security/ReentrancyGuard.sol` -> `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
  - `@openzeppelin/contracts/security/Pausable.sol` -> `@openzeppelin/contracts/utils/Pausable.sol`
  - `@openzeppelin/contracts/math/Math.sol` -> `@openzeppelin/contracts/utils/math/Math.sol`
  - draft ERC20 permit imports to their v5 paths
- Upgradeable import moves for the same safe path changes
- Allowlisted upgradeable symbol rewrites when the corresponding import rewrite is safe:
  - `IERC20Upgradeable` -> `IERC20`
  - `IERC20MetadataUpgradeable` -> `IERC20Metadata`
  - `IERC20PermitUpgradeable` -> `IERC20Permit`
  - `AddressUpgradeable` -> `Address`
  - `SafeERC20Upgradeable` -> `SafeERC20`

## Manual Follow-Up

The workflow will keep explicit TODO markers for cases that need code-aware review:

- `ownable_constructor_initial_owner`
- `ownable_initializer_initial_owner`
- `token_hooks_update_migration`
- `removed_module_usage`
- `import_path_layout_review`

## Validate

```bash
npx codemod@latest workflow validate -w .
```

## Registry

Check the registry before publishing:

```bash
npx codemod@latest search "openzeppelin v5 safe imports"
```

Publish when ready:

```bash
npx codemod@latest publish
```

## Local Checks

```bash
npm test
```

Kaggle full-matrix evaluation (compile + test across all benchmark repos):

```bash
export CODEMOD_API_KEY="..."
npm run evaluate:matrix -- --mode full --workdir .codemod-eval-final --memory-tiers 4096,6144,8192,12288
```

Build the final submission payload files (`metrics.json`, draft markdowns, and payload JSON):

```bash
npm run evidence:submission
```

Strict final packaging to `docs/submission` (requires public links):

```bash
export SUBMISSION_DEMO_URL="https://<your-demo-video-url>"
export SUBMISSION_CASE_STUDY_URL="https://<your-case-study-url>"
npm run evidence:submission:final
```

`evidence:submission:final` expects `heavy-matrix-eval-slim` (portable subset from the successful heavy-matrix artifact).

Proof quick path:

```bash
npm ci
npm test
npm run evidence:ai -- --target .codemod-eval-final/openzeppelin-contracts-upgradeable --workflow-path . --output .codemod-eval-final/ai-proof-summary.json
npm run evidence:hackathon -- --workdirs .codemod-eval-final,.codemod-eval --ai-proof .codemod-eval-final/ai-proof-summary.json --output .codemod-eval-final/hackathon-requirements.json
export SUBMISSION_DEMO_URL="https://<your-demo-video-url>"
export SUBMISSION_LIVE_DEMO_URL="https://<your-live-demo-url>"
export SUBMISSION_CASE_STUDY_URL="https://<your-case-study-url>"
npm run evidence:submission:final
```

Canonical submission evidence files:

- `docs/submission/metrics.json`
- `docs/submission/dorahacks_submission_final.md`
- `docs/submission/dorahacks_form_payload.md`
- `docs/submission/evidence_sources.md`
- `docs/submission/evidence_manifest.json`
- `heavy-matrix-eval-slim/verdict-summary.json`
- `heavy-matrix-eval-slim/*/evaluation-summary.json`

## Live Replay Demo (Cloudflare Workers)

Build replay data from real evidence:

```bash
npm run live-demo:data
```

Run locally:

```bash
npm run live-demo:dev
```

Deploy:

```bash
npm run live-demo:deploy
```

The live demo is an interactive replay viewer over verified runs; it does not execute arbitrary repositories at runtime.

Notebook option for Kaggle runtime:

- `kaggle_full_verdict.ipynb`

Optional repo-level evaluation:

```bash
npm run evaluate -- ./target-repo --compile "forge build" --test "forge test"
```

Repo-url evaluation with OOM retry tiers:

```bash
npm run evaluate -- --repo-url "https://github.com/OpenZeppelin/openzeppelin-contracts.git" --ref "v4.9.6" --compile "npm install --ignore-scripts && npm run compile" --test "npm test" --memory-tiers "4096,6144,8192"
```

`--memory-tiers` is available only with `--repo-url`.
