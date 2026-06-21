// supabase/functions/_shared/mp-credentials.ts
// ------------------------------------------------------------------
// Helper único para resolver credenciais do Mercado Pago a partir do
// flag MP_AMBIENTE ("teste" | "producao").
// ------------------------------------------------------------------

export type MpAmbiente = "teste" | "producao";

export function getMpAmbiente(): MpAmbiente {
  const raw = (Deno.env.get("MP_AMBIENTE") ?? "producao").trim().toLowerCase();
  return raw === "teste" ? "teste" : "producao";
}

/**
 * Retorna o access token correspondente ao MP_AMBIENTE.
 * Lança Error com mensagem clara se o secret escolhido estiver vazio.
 */
export function getMpAccessToken(): { token: string; ambiente: MpAmbiente } {
  const ambiente = getMpAmbiente();
  const secretName = ambiente === "teste"
    ? "MERCADO_PAGO_ACCESS_TOKEN_TEST"
    : "MERCADO_PAGO_ACCESS_TOKEN";
  const token = Deno.env.get(secretName)?.trim();
  if (!token) {
    throw new Error(
      `Configuração inválida: MP_AMBIENTE='${ambiente}' mas o secret ${secretName} está vazio ou ausente.`,
    );
  }
  return { token, ambiente };
}

/**
 * Retorna a public key correspondente ao MP_AMBIENTE.
 * Lança Error com mensagem clara se o secret escolhido estiver vazio.
 */
export function getMpPublicKey(): { publicKey: string; ambiente: MpAmbiente } {
  const ambiente = getMpAmbiente();
  const secretName = ambiente === "teste"
    ? "MERCADO_PAGO_PUBLIC_KEY_TEST"
    : "MERCADO_PAGO_PUBLIC_KEY";
  const publicKey = Deno.env.get(secretName)?.trim();
  if (!publicKey) {
    throw new Error(
      `Configuração inválida: MP_AMBIENTE='${ambiente}' mas o secret ${secretName} está vazio ou ausente.`,
    );
  }
  return { publicKey, ambiente };
}
