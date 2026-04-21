import { describe, expect, it } from "vitest";
import {
  applyCodemodToSource,
  applyCodemodToSourceWithContext,
} from "../src/engine.js";

describe("applyCodemodToSource", () => {
  it("returns synchronous results for source-only transforms", () => {
    const input = [
      'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";',
      "contract Vault is ReentrancyGuard {}",
      "",
    ].join("\n");

    const result = applyCodemodToSource(input);

    expect(result).not.toBeInstanceOf(Promise);
    expect(result.output).toContain(
      'import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";',
    );
  });

  it("rewrites ReentrancyGuard import path deterministically", () => {
    const input = [
      'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";',
      "contract Vault is ReentrancyGuard {}",
      "",
    ].join("\n");

    const result = applyCodemodToSource(input);

    expect(result.output).toContain(
      'import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";',
    );
    expect(result.changed).toBe(true);
    expect(result.metrics.deterministicRewrites).toBe(1);
    expect(result.metrics.todoMarkers).toBe(0);
    expect(result.metrics.ruleHits.contracts_security_reentrancyguard_import).toBe(
      1,
    );
  });

  it("rewrites allowlisted upgradeable interface import and symbol names", () => {
    const input = [
      'import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";',
      "interface Vault {",
      "  function token() external view returns (IERC20Upgradeable);",
      "}",
      "",
    ].join("\n");

    const result = applyCodemodToSource(input);

    expect(result.changed).toBe(true);
    expect(result.output).toContain(
      'import "@openzeppelin/contracts/token/ERC20/IERC20.sol";',
    );
    expect(result.output).toContain("returns (IERC20);");
    expect(result.output).not.toContain("IERC20Upgradeable");
    expect(result.metrics.ruleHits.contracts_upgradeable_i_erc20_import).toBe(1);
    expect(result.metrics.ruleHits.erc20_i_erc20_symbol).toBe(1);
    expect(result.metrics.todoMarkers).toBe(0);
  });

  it("marks ownable constructor migration as TODO with category metadata", () => {
    const input = [
      'import "@openzeppelin/contracts/access/Ownable.sol";',
      "contract Vault is Ownable {",
      "  constructor() {}",
      "}",
      "",
    ].join("\n");

    const result = applyCodemodToSource(input);

    expect(result.changed).toBe(true);
    expect(result.output).toContain(
      "OZ-V5-TODO[ownable_constructor_initial_owner]",
    );
    expect(result.metrics.todoMarkers).toBe(1);
    expect(result.metrics.todoByCategory.ownable_constructor_initial_owner).toBe(
      1,
    );
  });

  it("marks ownable initializer migration as TODO", () => {
    const input = [
      "function initialize() public initializer {",
      "  __Ownable_init();",
      "}",
      "",
    ].join("\n");

    const result = applyCodemodToSource(input);

    expect(result.output).toContain(
      "OZ-V5-TODO[ownable_initializer_initial_owner]",
    );
    expect(result.metrics.todoByCategory.ownable_initializer_initial_owner).toBe(
      1,
    );
  });

  it("marks token hook and removed module usage as TODO categories", () => {
    const input = [
      "using SafeMath for uint256;",
      "function _beforeTokenTransfer(address from, address to, uint256 value) internal override {}",
      "",
    ].join("\n");

    const result = applyCodemodToSource(input);

    expect(result.output).toContain("OZ-V5-TODO[token_hooks_update_migration]");
    expect(result.output).toContain("OZ-V5-TODO[removed_module_usage]");
    expect(result.metrics.todoByCategory.token_hooks_update_migration).toBe(1);
    expect(result.metrics.todoByCategory.removed_module_usage).toBe(1);
  });

  it("is idempotent and does not duplicate TODO markers", () => {
    const input = [
      'import "@openzeppelin/contracts/access/Ownable.sol";',
      "contract Vault is Ownable {",
      "  constructor() {}",
      "}",
      "",
    ].join("\n");

    const once = applyCodemodToSource(input);
    const twice = applyCodemodToSource(once.output);

    expect(twice.changed).toBe(false);
    expect(
      (twice.output.match(/OZ-V5-TODO\[ownable_constructor_initial_owner\]/g) ??
        []).length,
    ).toBe(1);
    expect(twice.metrics.todoMarkers).toBe(1);
  });

  it("emits a layout review TODO when the target import path is unavailable", () => {
    const input = [
      'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";',
      "contract Vault is ReentrancyGuard {}",
      "",
    ].join("\n");

    const result = applyCodemodToSourceWithContext(input, {
      canResolveImport(importPath) {
        return importPath !== "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
      },
    });

    expect(result.output).toContain(
      "OZ-V5-TODO[import_path_layout_review]",
    );
    expect(result.output).toContain(
      'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";',
    );
    expect(result.output).not.toContain(
      'import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";',
    );
    expect(result.metrics.todoByCategory.import_path_layout_review).toBe(1);
    expect(result.metrics.aiFollowupRequired).toBe(true);
  });
});
