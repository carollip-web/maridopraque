// supabase/functions/mp-token-sanity/index.ts
// ------------------------------------------------------------------
// SANITY CHECK efêmero do token do Mercado Pago após rotação.
// Só faz GET /users/me — não cria, não captura, não toca em pagamento.
// ------------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "CHECK_TOKEN") {
    return json({ error: 'Envie {"confirm":"CHECK_TOKEN"} no corpo.' }, 400);
  }

  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ??
    Deno.env.get("MP_ACCESS_TOKEN");
  if (!token) {
    return json({ ok: false, erro: "Secret MERCADO_PAGO_ACCESS_TOKEN não encontrado." }, 500);
  }

  const ambiente = token.startsWith("TEST-")
    ? "teste"
    : token.startsWith("APP_USR-")
    ? "producao"
    : "desconhecido";

  const res = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));

  return json({
    token_autentica: res.ok,
    http_status: res.status,
    ambiente,
    conta: {
      nickname: data.nickname,
      email: data.email,
      site_id: data.site_id,
    },
    veredito: res.ok && ambiente === "teste"
      ? "OK — token de teste válido e autenticando"
      : res.ok
      ? `Autentica, mas ambiente é '${ambiente}' (esperado 'teste' em pré-lançamento)`
      : "FALHOU — token não autentica (verifique se o secret foi atualizado)",
  });
});
