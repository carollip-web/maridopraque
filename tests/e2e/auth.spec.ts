import { test, expect } from "@playwright/test";
import { ACCOUNTS, login, logout } from "./helpers/auth";

test.describe("Autenticação dos 3 perfis", () => {
  test("cliente faz login e cai em /cliente", async ({ page }) => {
    await login(page, ACCOUNTS.cliente);
    await expect(page).toHaveURL(/\/cliente/);
    await logout(page);
  });

  test("profissional faz login e cai em /profissional", async ({ page }) => {
    await login(page, ACCOUNTS.pro);
    await expect(page).toHaveURL(/\/profissional/);
    await logout(page);
  });

  test("admin faz login e cai em /admin", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await expect(page).toHaveURL(/\/admin/);
    await logout(page);
  });
});
