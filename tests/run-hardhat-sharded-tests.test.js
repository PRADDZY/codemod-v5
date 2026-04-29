import { describe, expect, it } from "vitest";
import {
  parseShardedTestArgs,
  splitIntoChunks,
} from "../scripts/run-hardhat-sharded-tests.js";

describe("run-hardhat-sharded-tests argument parsing", () => {
  it("uses defaults", () => {
    const parsed = parseShardedTestArgs([]);
    expect(parsed.chunkSize).toBe(20);
    expect(parsed.patterns).toEqual([
      "test/**/*.js",
      "test/**/*.cjs",
      "test/**/*.mjs",
      "test/**/*.ts",
    ]);
    expect(parsed.help).toBe(false);
  });

  it("parses explicit chunk size and patterns", () => {
    const parsed = parseShardedTestArgs([
      "--chunk-size",
      "8",
      "--patterns",
      "test/unit/**/*.js,test/integration/**/*.js",
    ]);
    expect(parsed.chunkSize).toBe(8);
    expect(parsed.patterns).toEqual([
      "test/unit/**/*.js",
      "test/integration/**/*.js",
    ]);
  });

  it("rejects invalid chunk size values", () => {
    expect(() => parseShardedTestArgs(["--chunk-size", "0"])).toThrow(
      "Invalid --chunk-size value",
    );
  });
});

describe("run-hardhat-sharded-tests chunking", () => {
  it("splits entries into deterministic fixed-size shards", () => {
    const files = ["a", "b", "c", "d", "e"];
    expect(splitIntoChunks(files, 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });

  it("rejects invalid chunk sizes", () => {
    expect(() => splitIntoChunks(["a"], 0)).toThrow(
      "chunkSize must be a positive integer.",
    );
  });
});
