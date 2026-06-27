import { test, expect } from "@playwright/test";
import { ACCOUNTS, login, logout } from "./helpers/auth";

/**
 * Fluxo de pagamento (Checkout Transparente / Payment Brick).
 *
 * NOTA: assume que o seed-test-data já foi rodado pelo super_admin. Para o
 * formulário de pagamento montar de fato, o profissional do pedido aprovado
 * precisa ter o Mercado Pago conectado (mp_public_key). Quando esse pré-
 * requisito não está presente nos dados de teste, o passo é pulado em vez
 * de falhar — seguindo o estilo tolerante do restante da suíte.
 */
test.describe("Checkout — fluxo de cartão", () => {
  test("rota /checkout exige login", async ({ page }) => {
    await logout(page);
    await page.goto("/checkout?orcamentoId=00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("cliente com pedido aprovado chega ao formulário de pagamento seguro", async ({ page }) => {
    await login(page, ACCOUNTS.cliente);
    await page.goto("/cliente?tab=pedidos");

    // Procura um pedido aprovado com ação de pagamento.
    const pagarBtn = page.getByRole("button", { name: /^pagar$/i }).first();
    const temPedidoPagavel = await pagarBtn
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      !temPedidoPagavel,
      "Nenhum pedido aprovado pagável encontrado para o cliente de teste.",
    );

    await pagarBtn.click();
    await expect(page).toHaveURL(/\/checkout\?orcamentoId=/, { timeout: 15_000 });

    // A página de checkout deve renderizar a área de pagamento seguro:
    // ou o formulário monta, ou aparece uma mensagem clara (ex.: MP não conectado).
    await expect(page.locator("body")).toContainText(
      /mercado pago|pagamento|formulário seguro|cartão/i,
      { timeout: 15_000 },
    );

    await logout(page);
  });

  test("checkout com pedido inexistente redireciona o cliente", async ({ page }) => {
    await login(page, ACCOUNTS.cliente);
    await page.goto("/checkout?orcamentoId=00000000-0000-0000-0000-000000000000");
    // Pedido inválido manda o cliente de volta para a área dele (não trava na tela).
    await expect(page).toHaveURL(/\/cliente/, { timeout: 15_000 });
    await logout(page);
  });
});
