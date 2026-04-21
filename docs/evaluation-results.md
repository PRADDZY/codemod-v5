# Evaluation Results

Date: 2026-04-21  
Runner: Windows (PowerShell), Node 22.18.0, Foundry forge 1.6.0-rc1

## Matrix Summary

| Target | Baseline Compile | Baseline Test | Codemod | Post Compile | Post Test | Regression |
|---|---:|---:|---:|---:|---:|---|
| `Cyfrin/foundry-defi-stablecoin-cu` | 0 | 0 | 0 | 1 | 1 | yes |
| `OpenZeppelin/openzeppelin-contracts@v4.9.6` | 0 | 134 | 0 | 0 | 134 | no |
| `OpenZeppelin/openzeppelin-contracts-upgradeable@v4.9.6` | 0 | 134 | 0 | 0 | 134 | no |

Status code convention: `0` pass.

## Notes

- Foundry target regression is on `security/ReentrancyGuard.sol` -> `utils/ReentrancyGuard.sol` after codemod while repository dependency layout still resolves to an older OpenZeppelin tree.
- For OpenZeppelin repositories on Windows, `npm ci` required `--ignore-scripts` because `scripts/prepare.sh` is a POSIX shell script.
- Full raw artifacts were generated under `.codemod-eval/` and are intentionally git-ignored.
