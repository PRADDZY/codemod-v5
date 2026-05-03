# OpenZeppelin v5 Safe Imports

Deterministic codemod workflow for migrating Solidity repositories to safe OpenZeppelin Contracts v5 import and symbol paths.

## Quick Links

- Registry: https://app.codemod.com/registry/%40praddzy/openzeppelin-v5-safe-imports
- Live replay demo: https://oz-v5-live-replay-demo.dpratik3005.workers.dev
- Case study: https://dev.to/pratik_daithankar_4a5c141/openzeppelin-v5-final-case-study-116k
- Verification run: https://github.com/PRADDZY/codemod-v5/actions/runs/25277555948
- Evidence docs: [docs/submission/evidence_sources.md](docs/submission/evidence_sources.md)

## Quickstart

Requirements:

- Node.js 18+
- A target repository containing Solidity files (`*.sol`)

Preview changes:

```bash
npx codemod@latest workflow run -w . -t /path/to/repo --no-interactive --allow-dirty --allow-fs --dry-run
```

Apply changes:

```bash
npx codemod@latest workflow run -w . -t /path/to/repo --no-interactive --allow-dirty --allow-fs
```

Optional AI follow-up for unresolved TODO markers:

```bash
npx codemod@latest workflow run -w . -t /path/to/repo --no-interactive --allow-dirty --allow-fs --param aiReview=true
```

## What It Rewrites Safely

- Import path moves:
  - `@openzeppelin/contracts/security/ReentrancyGuard.sol` -> `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
  - `@openzeppelin/contracts/security/Pausable.sol` -> `@openzeppelin/contracts/utils/Pausable.sol`
  - `@openzeppelin/contracts/math/Math.sol` -> `@openzeppelin/contracts/utils/math/Math.sol`
  - draft ERC20 permit imports to their v5 paths
- Matching upgradeable import moves for safe path changes
- Allowlisted symbol rewrites when the import rewrite is safe:
  - `IERC20Upgradeable` -> `IERC20`
  - `IERC20MetadataUpgradeable` -> `IERC20Metadata`
  - `IERC20PermitUpgradeable` -> `IERC20Permit`
  - `AddressUpgradeable` -> `Address`
  - `SafeERC20Upgradeable` -> `SafeERC20`

## What Requires Manual Review

The workflow preserves explicit TODO markers for code-aware decisions:

- `ownable_constructor_initial_owner`
- `ownable_initializer_initial_owner`
- `token_hooks_update_migration`
- `removed_module_usage`
- `import_path_layout_review`

## Safety Boundaries

- Non-allowlisted or ambiguous migrations are intentionally not auto-fixed.
- `OZ-V5-TODO[...]` markers are retained unless fully resolved.
- Scan scope is limited to Solidity files and excludes `node_modules`, `lib`, `out`, `artifacts`, and `cache`.

## Validate

```bash
npm test
npx codemod@latest workflow validate -w .
```

## Maintainer Commands

Check registry listing:

```bash
npx codemod@latest search "openzeppelin v5 safe imports"
```

Publish:

```bash
npx codemod@latest publish
```

Optional repo-level evaluation:

```bash
npm run evaluate -- ./target-repo --compile "forge build" --test "forge test"
```

## Evidence and Submission Docs

For verification artifacts and submission-ready materials, use files under [docs/submission](docs/submission), especially:

- [docs/submission/metrics.json](docs/submission/metrics.json)
- [docs/submission/evidence_manifest.json](docs/submission/evidence_manifest.json)
- [docs/submission/evidence_sources.md](docs/submission/evidence_sources.md)

## License

MIT
