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

## Coverage

- Safe import moves:
  - `@openzeppelin/contracts/security/ReentrancyGuard.sol` -> `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
  - `@openzeppelin/contracts/security/Pausable.sol` -> `@openzeppelin/contracts/utils/Pausable.sol`
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

Optional repo-level evaluation:

```bash
npm run evaluate -- ./target-repo --compile "forge build" --test "forge test"
```
