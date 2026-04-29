#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";

const DEFAULT_CHUNK_SIZE = 20;
const DEFAULT_PATTERNS = [
  "test/**/*.js",
  "test/**/*.cjs",
  "test/**/*.mjs",
  "test/**/*.ts",
];

export function parseShardedTestArgs(argv) {
  const options = {
    chunkSize: DEFAULT_CHUNK_SIZE,
    patterns: [...DEFAULT_PATTERNS],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--chunk-size") {
      const raw = argv[index + 1] ?? "";
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid --chunk-size value: ${raw}`);
      }
      options.chunkSize = parsed;
      index += 1;
      continue;
    }
    if (current === "--patterns") {
      const raw = argv[index + 1] ?? "";
      const patterns = raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (patterns.length === 0) {
        throw new Error("--patterns must contain at least one glob.");
      }
      options.patterns = patterns;
      index += 1;
      continue;
    }
    if (current === "-h" || current === "--help") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown option: ${current}`);
  }

  return options;
}

export function splitIntoChunks(entries, chunkSize) {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error("chunkSize must be a positive integer.");
  }
  const chunks = [];
  for (let index = 0; index < entries.length; index += chunkSize) {
    chunks.push(entries.slice(index, index + chunkSize));
  }
  return chunks;
}

async function discoverTestFiles(patterns) {
  const files = await fg(patterns, {
    cwd: process.cwd(),
    onlyFiles: true,
    dot: false,
    unique: true,
    ignore: ["**/node_modules/**"],
  });

  return files.sort((left, right) => left.localeCompare(right));
}

function runHardhatShard(shard) {
  return spawnSync("npx", ["hardhat", "test", "--no-compile", ...shard], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function usageText() {
  return [
    "Usage:",
    "  node ./scripts/run-hardhat-sharded-tests.js [--chunk-size <n>] [--patterns <glob1,glob2>]",
    "",
    "Example:",
    "  node ./scripts/run-hardhat-sharded-tests.js --chunk-size 20",
  ].join("\n");
}

async function main() {
  const options = parseShardedTestArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usageText()}\n`);
    return;
  }

  const testFiles = await discoverTestFiles(options.patterns);
  if (testFiles.length === 0) {
    throw new Error("No Hardhat test files discovered for shard execution.");
  }

  const shards = splitIntoChunks(testFiles, options.chunkSize);
  process.stdout.write(
    `[hardhat-shards] discovered_files=${testFiles.length} shard_size=${options.chunkSize} shard_count=${shards.length} node_options="${process.env.NODE_OPTIONS ?? ""}"\n`,
  );

  for (let index = 0; index < shards.length; index += 1) {
    const shardNumber = index + 1;
    const shard = shards[index];
    const start = Date.now();
    process.stdout.write(
      `[hardhat-shards] shard=${shardNumber}/${shards.length} files=${shard.length} first="${shard[0]}" last="${shard[shard.length - 1]}"\n`,
    );

    const result = runHardhatShard(shard);
    const durationMs = Date.now() - start;
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    process.stdout.write(
      `[hardhat-shards] shard=${shardNumber}/${shards.length} duration_ms=${durationMs} exit=${result.status ?? 1}\n`,
    );

    if ((result.status ?? 1) !== 0) {
      process.stderr.write(
        `[hardhat-shards] failed_shard=${shardNumber}/${shards.length} shard_files=${JSON.stringify(
          shard,
        )}\n`,
      );
      process.exit(result.status ?? 1);
    }
  }
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exit(1);
  });
}
