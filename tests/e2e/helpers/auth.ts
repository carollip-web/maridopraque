import { Page } from "@playwright/test";

export const TEST_PASSWORD = "Teste@2026!";
export const TEST_DOMAIN = "teste.maridopraque.local";

export const ACCOUNTS = {
  admin: `admin-teste@${TEST_DOMAIN}`,
  pro: `pro1@${TEST_DOMAIN}`,
  cliente: `cli1@${TEST_DOMAIN}`,
};

export async function login(page: Page, email: string, password = TEST_PASSWORD) {
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /entrar agora/i }).click();
  await page.waitForURL(/\/(cliente|profissional|admin)/, { timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-"))
      .forEach((k) => localStorage.removeItem(k));
  });
  await page.context().clearCookies();
}
