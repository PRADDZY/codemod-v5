import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

const DEFAULT_INCLUDE = ["**/*.sol"];
const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/lib/**",
  "**/out/**",
  "**/artifacts/**",
  "**/cache/**",
];

const DETERMINISTIC_REWRITES = [
  {
    from: /@openzeppelin\/contracts\/security\/ReentrancyGuard\.sol/g,
    to: "@openzeppelin/contracts/utils/ReentrancyGuard.sol",
  },
  {
    from: /@openzeppelin\/contracts\/security\/Pausable\.sol/g,
    to: "@openzeppelin/contracts/utils/Pausable.sol",
  },
  {
    from: /@openzeppelin\/contracts\/token\/ERC20\/extensions\/draft-ERC20Permit\.sol/g,
    to: "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol",
  },
];

export function applyCodemodToSource(source) {
  let output = source;
  let deterministicRewrites = 0;
  let todoMarkers = 0;

  for (const rewrite of DETERMINISTIC_REWRITES) {
    const before = output;
    output = output.replace(rewrite.from, rewrite.to);
    if (before !== output) {
      const matches = before.match(rewrite.from);
      deterministicRewrites += matches ? matches.length : 0;
    }
  }

  const hasOwnableInheritance = /\bis\s+[^{\n;]*\bOwnable\b/.test(output);
  if (hasOwnableInheritance) {
    const lines = output.split("\n");
    const transformedLines = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const previousLine = transformedLines[transformedLines.length - 1] ?? "";
      const hasUnsafeCtor = /^\s*constructor\s*\(\s*\)\s*(?:public|external|internal|private)?\s*\{/.test(
        line,
      );
      const alreadyMarked =
        previousLine.includes("OZ-V5-TODO") || line.includes("OZ-V5-TODO");
      if (hasUnsafeCtor && !alreadyMarked) {
        const indent = line.match(/^\s*/)?.[0] ?? "";
        transformedLines.push(
          `${indent}// OZ-V5-TODO: OpenZeppelin v5 Ownable constructor requires an explicit initialOwner; verify and update manually.`,
        );
        todoMarkers += 1;
      }
      transformedLines.push(line);
    }
    output = transformedLines.join("\n");
  }

  return {
    output,
    changed: output !== source,
    metrics: {
      deterministicRewrites,
      todoMarkers,
    },
  };
}

function normalizeArray(value, fallback) {
  if (!value) {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

export async function runCodemod({
  rootPath,
  dryRun,
  include,
  exclude,
  strict,
}) {
  const root = path.resolve(rootPath);
  const includeGlobs = normalizeArray(include, DEFAULT_INCLUDE);
  const excludeGlobs = normalizeArray(exclude, DEFAULT_EXCLUDE);
  const files = await fg(includeGlobs, {
    cwd: root,
    ignore: excludeGlobs,
    absolute: true,
    dot: false,
  });

  const report = {
    root_path: root,
    files_scanned: files.length,
    files_changed: 0,
    fp_checks: 0,
    todo_count: 0,
    deterministic_rewrites: 0,
    coverage_estimate: 0,
    strict_mode: Boolean(strict),
    dry_run: Boolean(dryRun),
  };

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const result = applyCodemodToSource(source);
    report.deterministic_rewrites += result.metrics.deterministicRewrites;
    report.todo_count += result.metrics.todoMarkers;
    if (result.changed) {
      report.files_changed += 1;
      if (!dryRun) {
        await fs.writeFile(file, result.output, "utf8");
      }
    }
  }

  const totalSignal = report.deterministic_rewrites + report.todo_count;
  report.coverage_estimate =
    totalSignal === 0
      ? 0
      : Number((report.deterministic_rewrites / totalSignal).toFixed(4));

  return report;
}
