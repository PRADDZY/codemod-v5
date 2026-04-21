import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONFIG = {
  include: ["**/*.sol"],
  exclude: [
    "**/node_modules/**",
    "**/lib/**",
    "**/out/**",
    "**/artifacts/**",
    "**/cache/**",
  ],
  strict: false,
};

export async function loadConfig(configPath) {
  if (!configPath) {
    return { ...DEFAULT_CONFIG };
  }

  const resolved = path.resolve(configPath);
  const raw = await fs.readFile(resolved, "utf8");
  const parsed = JSON.parse(raw);

  return {
    include: Array.isArray(parsed.include)
      ? parsed.include
      : DEFAULT_CONFIG.include,
    exclude: Array.isArray(parsed.exclude)
      ? parsed.exclude
      : DEFAULT_CONFIG.exclude,
    strict: Boolean(parsed.strict),
  };
}
