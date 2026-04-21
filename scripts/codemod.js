import fs from "node:fs/promises";
import path from "node:path";
import { useMetricAtom } from "codemod:metrics";
import {
  applyCodemodToSourceWithContext,
  buildRepoContext,
} from "../src/engine.js";

const SOURCE_DIR_NAMES = new Set(["contracts", "src", "test", "script", "scripts"]);
const PROJECT_MARKERS = [
  ".git",
  "foundry.toml",
  "hardhat.config.js",
  "hardhat.config.ts",
  "package.json",
  "remappings.txt",
];
const PROJECT_DIR_MARKERS = [
  "node_modules",
  "lib",
  "vendor",
  "openzeppelin-contracts",
  "openzeppelin-contracts-upgradeable",
];

const repoContextCache = new Map();

const deterministicRewriteMetric = useMetricAtom("deterministic_rewrites");
const todoMarkerMetric = useMetricAtom("todo_markers");
const ruleHitMetric = useMetricAtom("rule_hits");
const todoCategoryMetric = useMetricAtom("todo_categories");

function normalizePath(targetPath) {
  return targetPath.replace(/^\\\\\?\\/, "");
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function hasProjectMarkers(dirPath) {
  for (const marker of PROJECT_MARKERS) {
    if (await pathExists(path.join(dirPath, marker))) {
      return true;
    }
  }
  for (const marker of PROJECT_DIR_MARKERS) {
    if (await pathExists(path.join(dirPath, marker))) {
      return true;
    }
  }
  return false;
}

async function guessProjectRoot(filePath) {
  let current = path.dirname(normalizePath(filePath));
  let fallbackRoot = current;

  while (true) {
    if (await hasProjectMarkers(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (SOURCE_DIR_NAMES.has(path.basename(current))) {
      fallbackRoot = parent;
    }

    if (parent === current) {
      return fallbackRoot;
    }

    current = parent;
  }
}

async function getRepoContext(filePath) {
  const projectRoot = await guessProjectRoot(filePath);
  if (!repoContextCache.has(projectRoot)) {
    repoContextCache.set(projectRoot, buildRepoContext(projectRoot));
  }
  return repoContextCache.get(projectRoot);
}

function incrementMetric(metric, count, dimensions) {
  for (let index = 0; index < count; index += 1) {
    metric.increment(dimensions);
  }
}

export default async function transform(root) {
  const source = root.root().text();
  const repoContext = await getRepoContext(root.filename());
  const result = applyCodemodToSourceWithContext(source, repoContext);

  incrementMetric(
    deterministicRewriteMetric,
    result.metrics.deterministicRewrites,
    {},
  );

  for (const [ruleId, count] of Object.entries(result.metrics.ruleHits)) {
    incrementMetric(ruleHitMetric, count, { rule: ruleId });
  }

  for (const [category, count] of Object.entries(result.metrics.todoByCategory)) {
    incrementMetric(todoMarkerMetric, count, {});
    incrementMetric(todoCategoryMetric, count, { category });
  }

  return result.changed ? result.output : null;
}
