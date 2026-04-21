# OpenZeppelin v4 -> v5 Codemod

Deterministic migration codemod for Solidity projects using OpenZeppelin Contracts.

## What It Does

- Safely rewrites known import path changes:
  - `security/ReentrancyGuard.sol` -> `utils/ReentrancyGuard.sol`
  - `security/Pausable.sol` -> `utils/Pausable.sol`
  - `draft-ERC20Permit.sol` -> `ERC20Permit.sol`
- Rewrites upgradeable import paths for known-safe moves:
  - `contracts-upgradeable/security/*` -> `contracts-upgradeable/utils/*` for `ReentrancyGuardUpgradeable` and `PausableUpgradeable`
  - `draft-ERC20PermitUpgradeable.sol` -> `ERC20PermitUpgradeable.sol`
- Rewrites allowlisted upgradeable interface/library imports to non-upgradeable variants plus matching symbol names:
  - `IERC20Upgradeable`, `IERC20MetadataUpgradeable`, `IERC20PermitUpgradeable`, `AddressUpgradeable`, `SafeERC20Upgradeable`
- Adds explicit categorized TODO markers for ambiguous migrations:
  - `ownable_constructor_initial_owner`
  - `ownable_initializer_initial_owner`
  - `token_hooks_update_migration`
  - `removed_module_usage`
- Produces a machine-readable migration report.

## Install

```bash
npm install
```

## Run

Dry-run (default):

```bash
npx oz-v4-to-v5 --dry-run --report-json migration-report.json ./path/to/repo
```

Apply changes:

```bash
npx oz-v4-to-v5 --apply --report-json migration-report.json ./path/to/repo
```

Use config:

```bash
npx oz-v4-to-v5 --config oz-migrate.config.json --apply ./path/to/repo
```

Strict mode (non-zero exit when unresolved TODO markers exist):

```bash
npx oz-v4-to-v5 --apply --strict ./path/to/repo
```

## Report Contract

The generated report contains:

- `files_scanned`
- `files_changed`
- `fp_checks`
- `todo_count`
- `coverage_estimate`
- `deterministic_rewrites`
- `strict_mode`
- `dry_run`
- `rule_hits`
- `todo_by_category`
- `todo_locations` (`file`, `line`, `category`, `message`)

## Config

See `oz-migrate.config.json`:

```json
{
  "include": ["**/*.sol"],
  "exclude": ["**/node_modules/**", "**/out/**", "**/artifacts/**"],
  "strict": false
}
```

## Evaluation Harness

Run codemod + optional baseline/post compile/test commands on a local repository:

```bash
npm run evaluate -- ./target-repo --compile "forge build" --test "forge test"
```

Run against a remote repository (clone/fetch + optional ref checkout):

```bash
npm run evaluate -- --repo-url "https://github.com/OpenZeppelin/openzeppelin-contracts.git" --ref "v4.9.6" --workdir ".codemod-eval" --compile "npm run build" --test "npm test"
```

Outputs `evaluation-summary.json` and `migration-report.json` in the evaluated target directory.

## Codemod MCP (Optional)

Use Codemod MCP for rule discovery and iteration support:

```bash
npx codemod whoami --detailed
npx codemod@latest mcp --help
```

Recommended workflow:
1. Use MCP suggestions to identify candidate migration patterns.
2. Promote only deterministic, allowlisted rewrites into this codemod.
3. Add unit tests before enabling each new rewrite.

## Safety Policy

- Deterministic-only auto-rewrites.
- Ambiguous transformations are marked with `OZ-V5-TODO`.
- Re-running the codemod is idempotent for already migrated imports.
