import { describe, expect, it } from "vitest";
import { applyCodemodToSource } from "../src/engine.js";

describe("applyCodemodToSource", () => {
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
  });

  it("marks ambiguous Ownable constructor upgrade with TODO instead of unsafe rewrite", () => {
    const input = [
      'import "@openzeppelin/contracts/access/Ownable.sol";',
      "contract Vault is Ownable {",
      "  constructor() {}",
      "}",
      "",
    ].join("\n");

    const result = applyCodemodToSource(input);

    expect(result.changed).toBe(true);
    expect(result.output).toContain("OZ-V5-TODO");
    expect(result.metrics.todoMarkers).toBe(1);
  });

  it("is idempotent on already-migrated import paths", () => {
    const input = [
      'import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";',
      "contract Vault is ReentrancyGuard {}",
      "",
    ].join("\n");

    const once = applyCodemodToSource(input);
    const twice = applyCodemodToSource(once.output);

    expect(once.changed).toBe(false);
    expect(twice.changed).toBe(false);
    expect(twice.output).toBe(once.output);
  });
});
