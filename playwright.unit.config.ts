import { defineConfig } from "@playwright/test";

// Configuração separada para testes unitários (lógica pura, sem browser
// e sem servidor dev). Os testes e2e continuam em playwright.config.ts.
export default defineConfig({
  testDir: "./tests/unit",
  timeout: 10_000,
  fullyParallel: true,
  reporter: [["list"]],
});
