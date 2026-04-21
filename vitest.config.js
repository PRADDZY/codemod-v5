import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    exclude: [".codemod-eval/**", "node_modules/**"],
  },
});
