# OpenZeppelin v4 -> v5 Codemod

Deterministic migration codemod for Solidity projects using OpenZeppelin Contracts.

## What It Does

- Safely rewrites known import path changes:
  - `security/ReentrancyGuard.sol` -> `utils/ReentrancyGuard.sol`
  - `security/Pausable.sol` -> `utils/Pausable.sol`
  - `draft-ERC20Permit.sol` -> `ERC20Permit.sol`
- Adds explicit TODO markers for ambiguous `Ownable` constructor upgrades rather than making unsafe guesses.
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

Run codemod + optional compile/test commands on a target repository:

```bash
npm run evaluate -- ./target-repo --compile "forge build" --test "forge test"
```

Outputs `evaluation-summary.json` in the target repo.

## Safety Policy

- Deterministic-only auto-rewrites.
- Ambiguous transformations are marked with `OZ-V5-TODO`.
- Re-running the codemod is idempotent for already migrated imports.
