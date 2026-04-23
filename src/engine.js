import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_INCLUDE = ["**/*.sol"];
const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/lib/**",
  "**/out/**",
  "**/artifacts/**",
  "**/cache/**",
];

const TODO_MARKER_REGEX = /OZ-V5-TODO\[(?<category>[a-z0-9_]+)\]:\s*(?<message>.*)$/;
const OZ_CONTRACTS_PREFIX = "@openzeppelin/contracts/";
const OZ_UPGRADEABLE_PREFIX = "@openzeppelin/contracts-upgradeable/";

const SYMBOL_REWRITE_RULES = {
  erc20_i_erc20_symbol: {
    from: "IERC20Upgradeable",
    to: "IERC20",
  },
  erc20_i_erc20_metadata_symbol: {
    from: "IERC20MetadataUpgradeable",
    to: "IERC20Metadata",
  },
  erc20_i_erc20_permit_symbol: {
    from: "IERC20PermitUpgradeable",
    to: "IERC20Permit",
  },
  utils_address_symbol: {
    from: "AddressUpgradeable",
    to: "Address",
  },
  erc20_safe_erc20_symbol: {
    from: "SafeERC20Upgradeable",
    to: "SafeERC20",
  },
};

const IMPORT_REWRITE_RULES = [
  {
    id: "contracts_security_reentrancyguard_import",
    importFrom: "@openzeppelin/contracts/security/ReentrancyGuard.sol",
    importTo: "@openzeppelin/contracts/utils/ReentrancyGuard.sol",
  },
  {
    id: "contracts_security_pausable_import",
    importFrom: "@openzeppelin/contracts/security/Pausable.sol",
    importTo: "@openzeppelin/contracts/utils/Pausable.sol",
  },
  {
    id: "contracts_erc20permit_draft_import",
    importFrom:
      "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol",
    importTo: "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol",
  },
  {
    id: "contracts_math_math_import",
    importFrom: "@openzeppelin/contracts/math/Math.sol",
    importTo: "@openzeppelin/contracts/utils/math/Math.sol",
  },
  {
    id: "contracts_upgradeable_security_reentrancyguard_import",
    importFrom:
      "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol",
    importTo:
      "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol",
  },
  {
    id: "contracts_upgradeable_security_pausable_import",
    importFrom: "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol",
    importTo: "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol",
  },
  {
    id: "contracts_upgradeable_erc20permit_draft_import",
    importFrom:
      "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol",
    importTo:
      "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol",
  },
  {
    id: "contracts_upgradeable_math_math_import",
    importFrom: "@openzeppelin/contracts-upgradeable/math/MathUpgradeable.sol",
    importTo: "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol",
  },
  {
    id: "contracts_upgradeable_i_erc20_import",
    importFrom:
      "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol",
    importTo: "@openzeppelin/contracts/token/ERC20/IERC20.sol",
    symbolRewriteIds: ["erc20_i_erc20_symbol"],
  },
  {
    id: "contracts_upgradeable_i_erc20_metadata_import",
    importFrom:
      "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol",
    importTo:
      "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol",
    symbolRewriteIds: ["erc20_i_erc20_metadata_symbol"],
  },
  {
    id: "contracts_upgradeable_i_erc20_permit_import",
    importFrom:
      "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20PermitUpgradeable.sol",
    importTo: "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol",
    symbolRewriteIds: ["erc20_i_erc20_permit_symbol"],
  },
  {
    id: "contracts_upgradeable_i_erc20_permit_draft_import",
    importFrom:
      "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol",
    importTo: "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol",
    symbolRewriteIds: ["erc20_i_erc20_permit_symbol"],
  },
  {
    id: "contracts_upgradeable_address_import",
    importFrom: "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol",
    importTo: "@openzeppelin/contracts/utils/Address.sol",
    symbolRewriteIds: ["utils_address_symbol"],
  },
  {
    id: "contracts_upgradeable_safe_erc20_import",
    importFrom:
      "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol",
    importTo: "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol",
    symbolRewriteIds: ["erc20_safe_erc20_symbol"],
  },
];

const TODO_DEFINITIONS = [
  {
    category: "ownable_constructor_initial_owner",
    message:
      "OpenZeppelin v5 Ownable constructor requires an explicit initialOwner argument; update this constructor manually.",
    shouldFlag: ({ line, hasOwnableInheritance }) =>
      hasOwnableInheritance &&
      /^\s*constructor\s*\(\s*\)\s*(?:public|external|internal|private)?(?:\s+payable)?(?:\s+[^{;]+)?\s*\{/.test(
        line,
      ),
  },
  {
    category: "ownable_initializer_initial_owner",
    message:
      "OpenZeppelin v5 __Ownable_init now requires an explicit initialOwner argument; update initializer call manually.",
    shouldFlag: ({ line }) =>
      /\b__Ownable_init(?:_unchained)?\s*\(\s*\)/.test(line),
  },
  {
    category: "token_hooks_update_migration",
    message:
      "OpenZeppelin v5 token transfer hooks moved to _update; migrate _beforeTokenTransfer/_afterTokenTransfer logic manually.",
    shouldFlag: ({ line }) =>
      /\b_(beforeTokenTransfer|afterTokenTransfer)\s*\(/.test(line),
  },
];

const REMOVED_MODULE_PATTERNS = [
  { name: "SafeMath", pattern: /\bSafeMath\b/ },
  { name: "Counters", pattern: /\bCounters\b/ },
  { name: "TokenTimelock", pattern: /\bTokenTimelock\b/ },
  { name: "ERC777", pattern: /\bERC777\b/ },
  { name: "Address.isContract", pattern: /\.\s*isContract\s*\(/ },
];

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function incrementCounter(target, key, amount) {
  target[key] = (target[key] ?? 0) + amount;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function dedupe(values) {
  return [...new Set(values)];
}

function parseFoundryRemappings(raw) {
  return [...raw.matchAll(/["']([^"']+?=.+?)["']/g)].map((match) => match[1]);
}

async function loadRemappings(root) {
  const remappings = [];
  const remappingsPath = path.join(root, "remappings.txt");
  if (await pathExists(remappingsPath)) {
    const fileRemappings = await fs.readFile(remappingsPath, "utf8");
    remappings.push(...fileRemappings.split(/\r?\n/));
  }

  const foundryConfigPath = path.join(root, "foundry.toml");
  if (await pathExists(foundryConfigPath)) {
    const foundryConfig = await fs.readFile(foundryConfigPath, "utf8");
    remappings.push(...parseFoundryRemappings(foundryConfig));
  }

  return remappings
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/['"]/g, ""))
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        return null;
      }
      return {
        alias: line.slice(0, separatorIndex),
        target: line.slice(separatorIndex + 1),
      };
    })
    .filter(Boolean);
}

function defaultImportBases(root) {
  return {
    [OZ_CONTRACTS_PREFIX]: dedupe([
      path.join(root, "node_modules", "@openzeppelin", "contracts"),
      path.join(root, "lib", "openzeppelin-contracts", "contracts"),
      path.join(root, "openzeppelin-contracts", "contracts"),
      path.join(root, "vendor", "openzeppelin-contracts", "contracts"),
    ]),
    [OZ_UPGRADEABLE_PREFIX]: dedupe([
      path.join(root, "node_modules", "@openzeppelin", "contracts-upgradeable"),
      path.join(root, "lib", "openzeppelin-contracts-upgradeable", "contracts"),
      path.join(root, "openzeppelin-contracts-upgradeable", "contracts"),
      path.join(root, "vendor", "openzeppelin-contracts-upgradeable", "contracts"),
    ]),
  };
}

export async function buildRepoContext(root) {
  const importBases = defaultImportBases(root);
  const remappings = await loadRemappings(root);
  for (const remapping of remappings) {
    if (!importBases[remapping.alias]) {
      continue;
    }
    importBases[remapping.alias].push(path.resolve(root, remapping.target));
  }

  const resolvedImportBases = Object.fromEntries(
    Object.entries(importBases).map(([prefix, bases]) => [prefix, dedupe(bases)]),
  );
  async function resolveImport(importPath) {
    const prefix = Object.keys(resolvedImportBases).find((candidate) =>
      importPath.startsWith(candidate),
    );
    if (!prefix) {
      return true;
    }

    const suffix = importPath.slice(prefix.length);
    for (const basePath of resolvedImportBases[prefix]) {
      if (await pathExists(path.join(basePath, suffix))) {
        return true;
      }
    }
    return false;
  }

  const resolvedImportCache = new Map();
  const relevantImports = dedupe(IMPORT_REWRITE_RULES.map((rewrite) => rewrite.importTo));
  for (const importPath of relevantImports) {
    resolvedImportCache.set(importPath, await resolveImport(importPath));
  }

  function canResolveImport(importPath) {
    if (resolvedImportCache.has(importPath)) {
      return resolvedImportCache.get(importPath);
    }
    const prefix = Object.keys(resolvedImportBases).find((candidate) =>
      importPath.startsWith(candidate),
    );
    return !prefix;
  }

  return {
    canResolveImport,
  };
}

function hasTodoCategory(line, category) {
  const categoryRegex = new RegExp(
    `OZ-V5-TODO\\[${escapeRegExp(category)}\\]`,
  );
  return categoryRegex.test(line);
}

function addTodoMarkerIfMissing(outputLines, line, category, message) {
  const previousLine = outputLines[outputLines.length - 1] ?? "";
  if (hasTodoCategory(previousLine, category) || hasTodoCategory(line, category)) {
    return;
  }

  const indent = line.match(/^\s*/)?.[0] ?? "";
  outputLines.push(`${indent}// OZ-V5-TODO[${category}]: ${message}`);
}

function applyDeterministicRewrites(source, repoContext) {
  let output = source;
  let deterministicRewrites = 0;
  const ruleHits = {};
  const activeSymbolRewriteIds = new Set();

  for (const rewrite of IMPORT_REWRITE_RULES) {
    const canRewrite = repoContext.canResolveImport(rewrite.importTo);
    if (!canRewrite) {
      continue;
    }
    const rewriteRegex = new RegExp(escapeRegExp(rewrite.importFrom), "g");
    let matches = 0;
    output = output.replace(rewriteRegex, () => {
      matches += 1;
      return rewrite.importTo;
    });
    if (matches > 0) {
      incrementCounter(ruleHits, rewrite.id, matches);
      deterministicRewrites += matches;
      for (const symbolRewriteId of rewrite.symbolRewriteIds ?? []) {
        activeSymbolRewriteIds.add(symbolRewriteId);
      }
    }
  }

  for (const symbolRewriteId of activeSymbolRewriteIds) {
    const symbolRewrite = SYMBOL_REWRITE_RULES[symbolRewriteId];
    if (!symbolRewrite) {
      continue;
    }
    const tokenRegex = new RegExp(
      `\\b${escapeRegExp(symbolRewrite.from)}\\b`,
      "g",
    );
    let matches = 0;
    output = output.replace(tokenRegex, () => {
      matches += 1;
      return symbolRewrite.to;
    });
    if (matches > 0) {
      incrementCounter(ruleHits, symbolRewriteId, matches);
      deterministicRewrites += matches;
    }
  }

  return {
    output,
    deterministicRewrites,
    ruleHits,
  };
}

function applyTodoDetectors(source, repoContext) {
  const hasOwnableInheritance = /\bis\s+[^{\n;]*\bOwnable\b/.test(source);
  const inputLines = source.split("\n");
  const outputLines = [];

  for (const line of inputLines) {
    for (const rewrite of IMPORT_REWRITE_RULES) {
      const containsImport = line.includes(rewrite.importFrom);
      if (!containsImport) {
        continue;
      }
      const canRewrite = repoContext.canResolveImport(rewrite.importTo);
      if (canRewrite) {
        continue;
      }
      addTodoMarkerIfMissing(
        outputLines,
        line,
        "import_path_layout_review",
        `Skipped ${rewrite.importFrom} -> ${rewrite.importTo} because the target path is not present in this repository layout.`,
      );
    }

    for (const detector of TODO_DEFINITIONS) {
      if (!detector.shouldFlag({ line, hasOwnableInheritance })) {
        continue;
      }
      addTodoMarkerIfMissing(
        outputLines,
        line,
        detector.category,
        detector.message,
      );
    }

    const removedModules = REMOVED_MODULE_PATTERNS.filter(({ pattern }) =>
      pattern.test(line),
    ).map(({ name }) => name);
    if (removedModules.length > 0) {
      const uniqueModules = [...new Set(removedModules)];
      addTodoMarkerIfMissing(
        outputLines,
        line,
        "removed_module_usage",
        `OpenZeppelin v5 removed or changed ${uniqueModules.join(", ")}; migrate this usage manually.`,
      );
    }

    outputLines.push(line);
  }

  return {
    output: outputLines.join("\n"),
  };
}

function collectTodoMetadata(source) {
  const todoLocations = [];
  const todoByCategory = {};
  const lines = source.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(TODO_MARKER_REGEX);
    if (!match?.groups) {
      continue;
    }
    const category = match.groups.category;
    const message = match.groups.message.trim();
    incrementCounter(todoByCategory, category, 1);
    todoLocations.push({
      line: index + 1,
      category,
      message,
    });
  }

  return {
    todoLocations,
    todoByCategory,
  };
}

export function applyCodemodToSource(source) {
  return applyCodemodToSourceWithContext(source, {
    canResolveImport: () => true,
  });
}

export function applyCodemodToSourceWithContext(source, repoContext) {
  const deterministicResult = applyDeterministicRewrites(source, repoContext);
  const todoDetectorResult = applyTodoDetectors(deterministicResult.output, repoContext);
  const todoMetadata = collectTodoMetadata(todoDetectorResult.output);
  const totalSignal =
    deterministicResult.deterministicRewrites + todoMetadata.todoLocations.length;

  return {
    output: todoDetectorResult.output,
    changed: todoDetectorResult.output !== source,
    metrics: {
      deterministicRewrites: deterministicResult.deterministicRewrites,
      todoMarkers: todoMetadata.todoLocations.length,
      ruleHits: deterministicResult.ruleHits,
      todoByCategory: todoMetadata.todoByCategory,
      todoLocations: todoMetadata.todoLocations,
      automationRatioEstimate:
        totalSignal === 0
          ? 1
          : Number(
              (
                deterministicResult.deterministicRewrites / totalSignal
              ).toFixed(4),
            ),
      aiFollowupRequired: todoMetadata.todoLocations.length > 0,
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
  const { default: fg } = await import("fast-glob");
  const root = path.resolve(rootPath);
  const repoContext = await buildRepoContext(root);
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
    rule_hits: {},
    todo_by_category: {},
    todo_locations: [],
    automation_ratio_estimate: 1,
    ai_followup_required: false,
  };

  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join("/");
    const source = await fs.readFile(file, "utf8");
    const result = applyCodemodToSourceWithContext(source, repoContext);
    report.deterministic_rewrites += result.metrics.deterministicRewrites;
    report.todo_count += result.metrics.todoMarkers;
    for (const [ruleId, hits] of Object.entries(result.metrics.ruleHits)) {
      incrementCounter(report.rule_hits, ruleId, hits);
    }
    for (const [category, count] of Object.entries(result.metrics.todoByCategory)) {
      incrementCounter(report.todo_by_category, category, count);
    }
    for (const location of result.metrics.todoLocations) {
      report.todo_locations.push({
        file: relativePath,
        line: location.line,
        category: location.category,
        message: location.message,
      });
    }
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
  report.automation_ratio_estimate =
    totalSignal === 0
      ? 1
      : Number((report.deterministic_rewrites / totalSignal).toFixed(4));
  report.ai_followup_required = report.todo_count > 0;

  return report;
}
