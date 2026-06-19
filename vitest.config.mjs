import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve("."),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.test.mjs"],
  },
});
