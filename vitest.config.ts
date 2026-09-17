/**
 * Configura las pruebas unitarias y de integración, alias de importación y tiempos máximos. Los archivos de pruebas deben terminar en .test.ts.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve("src"),
      "server-only": path.resolve("tests/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
