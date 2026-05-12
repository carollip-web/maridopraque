import { test, expect } from "@playwright/test";
import { ACCOUNTS, login, logout } from "./helpers/auth";

/**
 * Fluxo end-to-end completo:
 * 1. Cliente vê seus pedidos
 * 2. Profissional vê pedidos disponíveis
 * 3. Admin vê tudo no dashboard
 *
 * NOTA: Este teste assume que o seed-test-data já foi rodado pelo super_admin
 * via /admin → Modo Teste. Caso contrário, falha por falta de contas.
 */
test.describe("Fluxo cliente → profissional → admin", () => {
  test("cliente vê dashboard com pedidos de teste", async ({ page }) => {
    await login(page, ACCOUNTS.cliente);
    await expect(page).toHaveURL(/\/cliente/);
    // Carla tem ao menos 1 pedido de teste seedado
    await expect(page.locator("body")).toContainText(/pedido|orçamento|serviço/i, { timeout: 10_000 });
    await logout(page);
  });

  test("profissional acessa painel", async ({ page }) => {
    await login(page, ACCOUNTS.pro);
    await expect(page).toHaveURL(/\/profissional/);
    await expect(page.locator("body")).toContainText(/orçamento|serviço|agenda/i, { timeout: 10_000 });
    await logout(page);
  });

  test("admin vê pedidos de teste no painel", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator("body")).toContainText(/dashboard|pedido/i, { timeout: 10_000 });
    await logout(page);
  });
});
