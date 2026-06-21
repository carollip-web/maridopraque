// supabase/functions/test-tipo-a-harness/index.ts
// HARNESS TEMPORÁRIO de teste (Tipo A)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "RODAR_TESTE_TIPO_A") {
    return json({ error: "Envie {\"confirm\":\"RODAR_TESTE_TIPO_A\"} no corpo." }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ??
    Deno.env.get("MP_ACCESS_TOKEN")!;

  const resultados: { nome: string; ok: boolean; detalhe?: unknown }[] = [];
  const check = (nome: string, ok: boolean, detalhe?: unknown) =>
    resultados.push({ nome, ok, detalhe });

  const adminH = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
  };

  const criarUsuario = async (email: string, senha: string) => {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: adminH,
      body: JSON.stringify({ email, password: senha, email_confirm: true }),
    });
    return (await r.json()).id as string;
  };
  const loginJWT = async (email: string, senha: string) => {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: senha }),
    });
    return (await r.json()).access_token as string;
  };
  const delUser = (id: string) =>
    fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: adminH });
  const rest = async (m: string, path: string, b?: unknown) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: m,
      headers: { ...adminH, Prefer: "return=representation" },
      body: b ? JSON.stringify(b) : undefined,
    });
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  };
  const mpH = { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" };
  const criarAutorizacao = async () => {
    const tok = await (await fetch("https://api.mercadopago.com/v1/card_tokens", {
      method: "POST",
      headers: mpH,
      body: JSON.stringify({
        card_number: "4235647728025682",
        expiration_month: 11,
        expiration_year: 2030,
        security_code: "123",
        cardholder: { name: "APRO", identification: { type: "CPF", number: "12345678909" } },
      }),
    })).json();
    const pay = await (await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: { ...mpH, "X-Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        transaction_amount: 200,
        capture: false,
        installments: 1,
        payment_method_id: "visa",
        token: tok.id,
        payer: { email: "comprador.teste@gmail.com" },
      }),
    })).json();
    return pay;
  };
  const chamarCaptura = async (jwt: string, orcamentoId: string, ator: string) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/mp-capturar-pagamento`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orcamento_id: orcamentoId, ator }),
    });
    return { http: r.status, data: await r.json().catch(() => ({})) };
  };

  const stamp = Date.now();
  const senha = "TesteTipoA!2026";
  let clienteId = "", profId = "", orcamentoId = "", pagamentoId = "";

  try {
    clienteId = await criarUsuario(`tipoa.cliente.${stamp}@gmail.com`, senha);
    profId = await criarUsuario(`tipoa.prof.${stamp}@gmail.com`, senha);
    check("Criou cliente e profissional", !!clienteId && !!profId);

    const jwtCliente = await loginJWT(`tipoa.cliente.${stamp}@gmail.com`, senha);
    const jwtProf = await loginJWT(`tipoa.prof.${stamp}@gmail.com`, senha);
    check("Obteve JWT dos dois", !!jwtCliente && !!jwtProf);

    const auth = await criarAutorizacao();
    check("Autorização real no MP (capture:false)", auth.status === "authorized", {
      status: auth.status,
      status_detail: auth.status_detail,
      message: auth.message,
    });

    const orc = await rest("POST", "orcamentos", {
      cliente_id: clienteId,
      profissional_id: profId,
      service_name: "Teste Tipo A",
      valor: 200,
      status: "aprovado",
    });
    orcamentoId = orc?.[0]?.id;
    check("Criou orçamento", !!orcamentoId);

    const pag = await rest("POST", "pagamentos", {
      orcamento_id: orcamentoId,
      cliente_id: clienteId,
      profissional_id: profId,
      valor_total: 200,
      gateway: "mercado_pago",
      gateway_payment_id: String(auth.id),
      status: "pending",
      status_autorizacao: "autorizado",
      autorizacao_expira_em: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
    pagamentoId = pag?.[0]?.id;
    check("Criou pagamento autorizado", !!pagamentoId);

    const t1 = await chamarCaptura(jwtCliente, orcamentoId, "profissional");
    check("T1: cliente como profissional → 403", t1.http === 403, t1.data);

    const t2 = await chamarCaptura(jwtProf, orcamentoId, "cliente");
    check("T2: profissional como cliente → 403", t2.http === 403, t2.data);

    const t3 = await chamarCaptura(jwtCliente, orcamentoId, "cliente");
    check("T3: um lado só → parcial", t3.data?.status === "partial", t3.data);
    const p1 = await rest("GET", `pagamentos?id=eq.${pagamentoId}&select=status_autorizacao`);
    check("T3b: banco ainda 'autorizado'", p1?.[0]?.status_autorizacao === "autorizado", p1?.[0]);

    const t4 = await chamarCaptura(jwtProf, orcamentoId, "profissional");
    check("T4: ambos confirmaram → captura", t4.data?.status === "captured", t4.data);
    const p2 = await rest("GET", `pagamentos?id=eq.${pagamentoId}&select=status_autorizacao`);
    check("T4b: banco agora 'capturado'", p2?.[0]?.status_autorizacao === "capturado", p2?.[0]);

    const t5 = await chamarCaptura(jwtCliente, orcamentoId, "cliente");
    check("T5: recaptura bloqueada (ALREADY_CAPTURED)", t5.data?.error === "ALREADY_CAPTURED", t5.data);
  } catch (e) {
    check("ERRO inesperado", false, (e as Error).message);
  } finally {
    try {
      if (pagamentoId) await rest("DELETE", `pagamentos?id=eq.${pagamentoId}`);
      if (orcamentoId) await rest("DELETE", `orcamentos?id=eq.${orcamentoId}`);
      if (clienteId) await delUser(clienteId);
      if (profId) await delUser(profId);
    } catch (_) { /* ignore */ }
  }

  const passed = resultados.filter((r) => r.ok).length;
  const failed = resultados.filter((r) => !r.ok).length;
  return json({ resumo: `${passed} passaram, ${failed} falharam`, todos_verdes: failed === 0, resultados });
});
