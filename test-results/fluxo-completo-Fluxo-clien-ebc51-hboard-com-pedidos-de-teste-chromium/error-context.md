# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fluxo-completo.spec.ts >> Fluxo cliente → profissional → admin >> cliente vê dashboard com pedidos de teste
- Location: tests/e2e/fluxo-completo.spec.ts:14:2

# Error details

```
TimeoutError: waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:8080/login?"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e2]:
    - banner [ref=e3]:
        - generic [ref=e4]:
            - link "Marido pra Quê?" [ref=e5] [cursor=pointer]:
                - /url: /
                - img [ref=e7]
                - generic [ref=e9]: Marido pra Quê?
            - navigation [ref=e10]:
                - link "Serviços" [ref=e11] [cursor=pointer]:
                    - /url: /servicos
                - link "Profissionais" [ref=e12] [cursor=pointer]:
                    - /url: /profissionais
                - link "Por que nós" [ref=e13] [cursor=pointer]:
                    - /url: /porque
                - link "Contato" [ref=e14] [cursor=pointer]:
                    - /url: /contato
                - link "Para profissionais" [ref=e15] [cursor=pointer]:
                    - /url: /para-profissionais
            - generic [ref=e16]:
                - button "Orçamento" [ref=e17]
                - button [ref=e19]:
                    - img [ref=e20]
    - main [ref=e23]:
        - generic [ref=e25]:
            - generic [ref=e26]:
                - link "Marido pra Quê?" [ref=e27] [cursor=pointer]:
                    - /url: /
                    - img [ref=e29]
                    - generic [ref=e31]: Marido pra Quê?
                - heading "Bem-vinda de volta" [level=1] [ref=e32]
                - paragraph [ref=e33]: Acesse sua área exclusiva para acompanhar pedidos e orçamentos.
            - generic [ref=e34]:
                - generic [ref=e35]:
                    - generic [ref=e36]:
                        - text: E-mail
                        - generic [ref=e37]:
                            - img [ref=e38]
                            - textbox "seu@email.com" [ref=e41]
                    - generic [ref=e42]:
                        - text: Senha
                        - generic [ref=e43]:
                            - img [ref=e44]
                            - textbox "••••••••" [ref=e47]
                            - button [ref=e48]:
                                - img [ref=e49]
                    - generic [ref=e52]:
                        - button "Manter conectado" [ref=e53]:
                            - img [ref=e54]
                            - text: Manter conectado
                        - button "Esqueci a senha" [ref=e56]
                    - button "Entrar Agora" [ref=e57]
                - generic [ref=e62]: Ou continue com
                - button "Continuar com Google" [ref=e63]
            - paragraph [ref=e64]:
                - text: Ainda não tem conta?
                - button "Cadastre-se grátis" [ref=e65]
            - paragraph [ref=e66]:
                - text: É profissional parceiro?
                - link "Entrar como profissional" [ref=e67] [cursor=pointer]:
                    - /url: /login/profissional
            - generic [ref=e68]:
                - img [ref=e69]
                - text: Ambiente 100% Seguro e Criptografado
    - contentinfo [ref=e72]:
        - generic [ref=e73]:
            - generic [ref=e74]:
                - img [ref=e76]
                - generic [ref=e78]: Marido pra Quê?
            - navigation [ref=e79]:
                - link "Serviços" [ref=e80] [cursor=pointer]:
                    - /url: /servicos
                - link "Equipe" [ref=e81] [cursor=pointer]:
                    - /url: /profissionais
                - link "Pagamento" [ref=e82] [cursor=pointer]:
                    - /url: /pagamento
                - link "Ajuda" [ref=e83] [cursor=pointer]:
                    - /url: /ajuda
                - link "Contato" [ref=e84] [cursor=pointer]:
                    - /url: /contato
            - paragraph [ref=e85]: © 2026 — Marido pra Quê?
    - link "Falar no WhatsApp" [ref=e86] [cursor=pointer]:
        - /url: https://wa.me/5521999999999?text=Olá!%20Quero%20falar%20com%20a%20equipe.
        - img [ref=e88]
    - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { Page } from "@playwright/test";
  2  |
  3  | export const TEST_PASSWORD = "Teste@2026!";
  4  | export const TEST_DOMAIN = "example.com";
  5  |
  6  | export const ACCOUNTS = {
  7  |   admin: `admin-teste@${TEST_DOMAIN}`,
  8  |   pro: `pro1@${TEST_DOMAIN}`,
  9  |   cliente: `cli1@${TEST_DOMAIN}`,
  10 | };
  11 |
  12 | export async function login(page: Page, email: string, password = TEST_PASSWORD) {
  13 |   await page.goto("/login");
  14 |   await page.getByPlaceholder("seu@email.com").fill(email);
  15 |   await page.getByPlaceholder("••••••••").fill(password);
  16 |   await page.getByRole("button", { name: /entrar agora/i }).click();
> 17 |   await page.waitForURL(/\/(cliente|profissional|admin)/, { timeout: 15_000 });
     |             ^ TimeoutError: waitForURL: Timeout 15000ms exceeded.
  18 | }
  19 |
  20 | export async function logout(page: Page) {
  21 |   await page.evaluate(() => {
  22 |     Object.keys(localStorage)
  23 |       .filter((k) => k.startsWith("sb-"))
  24 |       .forEach((k) => localStorage.removeItem(k));
  25 |   });
  26 |   await page.context().clearCookies();
  27 | }
  28 |
```
