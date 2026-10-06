/**
 * Configura el navegador y servidor utilizados por las pruebas de extremo a extremo.
 */
import { defineConfig } from "@playwright/test";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  use: {
    channel:
      process.env.E2E_BROWSER_CHANNEL ||
      (process.platform === "win32" ? "msedge" : undefined),
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: true,
  },
});
