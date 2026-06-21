import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    if (cronSecret && providedSecret !== cronSecret) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

    const logAudit = async (action: string, target_user_id: string, details: any) => {
      await admin.from("admin_audit_log").insert({
        actor_user_id: SYSTEM_ACTOR_ID,
        target_user_id,
        action,
        details,
      } as any);
    };

    const nowIso = new Date().toISOString();
    const actionsTaken: string[] = [];

    // Buscar autorizações já expiradas e não capturadas
    const { data: expirados, error: expErr } = await admin
      .from("pagamentos")
      .select("id, orcamento_id, cliente_id, autorizacao_expira_em")
      .eq("status_autorizacao", "autorizado")
      .lte("autorizacao_expira_em", nowIso);

    if (expErr) {
      console.error("Erro ao buscar autorizações expiradas", expErr);
      return json({ error: "DB_ERROR", message: expErr.message }, 500);
    }

    if (expirados && expirados.length > 0) {
      for (const pag of expirados) {
        try {
          await admin.functions.invoke("mp-recobranca-cartao", {
            body: { orcamento_id: pag.orcamento_id },
          });

          const { data: userData } = await admin.auth.admin.getUserById(pag.cliente_id);
          const emailDestinatario = userData?.user?.email;
          console.log(
            `[EMAIL] Assunto: Autorização expirada - link de pagamento gerado. Orçamento: ${pag.orcamento_id}. Destinatário: ${emailDestinatario || pag.cliente_id}`,
          );

          await logAudit("CRON_GERAR_LINK_PAGAMENTO", pag.cliente_id, {
            orcamento_id: pag.orcamento_id,
            motivo: "Autorização expirada - link de pagamento avulso gerado",
          });
          actionsTaken.push(`Link gerado para orçamento ${pag.orcamento_id}`);
        } catch (e) {
          console.error("Erro ao gerar link de pagamento", e);
        }
      }
    }

    return json({ ok: true, executed_actions: actionsTaken });
  } catch (err: any) {
    console.error("Erro fatal cron", err);
    return json({ error: "INTERNAL", message: err?.message || "Erro interno" }, 500);
  }
});
