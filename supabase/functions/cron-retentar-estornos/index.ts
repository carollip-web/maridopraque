import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: rows, error } = await admin
    .from("pagamento_splits")
    .select("orcamento_id, metadata")
    .eq("metadata->>estorno_pendente_saldo", "true")
    .is("metadata->>refund_id", null)
    .limit(50);

  if (error) {
    console.error("[cron-retentar-estornos] erro ao buscar splits", error.message);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orcamentoIds = Array.from(
    new Set((rows || []).map((r: any) => r.orcamento_id).filter(Boolean))
  );

  let sucesso = 0;
  let pendentes = 0;
  let falhas = 0;

  for (const orcamentoId of orcamentoIds) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/processar-estorno`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orcamentoId }),
      });
      let parsed: any = null;
      try { parsed = await resp.json(); } catch { /* ignore */ }

      if (resp.ok && parsed?.ok === true) {
        sucesso++;
        console.log(`[cron-retentar-estornos] orcamentoId=${orcamentoId} status=${resp.status} ok=true refundId=${parsed?.refundId ?? "n/a"}`);
      } else if (resp.ok && parsed?.pendente === true) {
        pendentes++;
        console.log(`[cron-retentar-estornos] orcamentoId=${orcamentoId} status=${resp.status} pendente=true motivo=${parsed?.motivo ?? "n/a"}`);
      } else {
        falhas++;
        console.log(`[cron-retentar-estornos] orcamentoId=${orcamentoId} status=${resp.status} falha=true`);
      }
    } catch (e: any) {
      falhas++;
      console.log(`[cron-retentar-estornos] orcamentoId=${orcamentoId} exception=${e?.message ?? String(e)}`);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processados: orcamentoIds.length,
      sucesso,
      pendentes,
      falhas,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
