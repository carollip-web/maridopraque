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
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

    if (!MP_ACCESS_TOKEN) return json({ error: "CONFIG_ERROR", message: "Token do MP não configurado." }, 500);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

    const logAudit = async (action: string, target_user_id: string, details: any) => {
      await admin.from("admin_audit_log").insert({
        actor_user_id: SYSTEM_ACTOR_ID,
        target_user_id,
        action,
        details
      } as any);
    };

    const now = new Date();
    // 48 hours from now
    const limit48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    // 24 hours ago
    const limit24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const actionsTaken: string[] = [];

    // --- PARTE 1: VERIFICAR AUTORIZAÇÕES PRESTES A EXPIRAR ---
    const { data: exp_pagamentos, error: expErr } = await admin
      .from("pagamentos")
      .select("*, orcamentos(id, data_preferida, status)")
      .eq("status_autorizacao", "autorizado")
      .lte("autorizacao_expira_em", limit48h);

    if (expErr) console.error("Erro ao buscar autorizações expirando", expErr);
    
    if (exp_pagamentos && exp_pagamentos.length > 0) {
      for (const pag of exp_pagamentos) {
        const orcamentoObj = Array.isArray(pag.orcamentos) ? pag.orcamentos[0] : pag.orcamentos;
        if (!orcamentoObj) continue;

        let ocorreu = false;
        if (orcamentoObj.data_preferida) {
          const dataServico = new Date(orcamentoObj.data_preferida);
          ocorreu = dataServico <= now;
        }

        if (!ocorreu) {
          // Serviço AINDA NÃO OCORREU: Criar nova autorização
          const paymentPayload = {
            transaction_amount: Number(pag.valor_total),
            capture: false,
            description: "Renovação de Autorização - Marido pra Que",
            installments: 1,
            payer: { type: "customer", id: pag.mp_customer_id },
            token: pag.mp_card_id,
            payment_method_id: pag.metadata?.mp_auth_response?.payment_method_id,
            issuer_id: pag.metadata?.mp_auth_response?.issuer_id,
            external_reference: pag.orcamento_id,
            statement_descriptor: "MARIDO PRA QUE"
          };

          const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
              "X-Idempotency-Key": `${pag.id}-renew-auth-${now.getTime()}`
            },
            body: JSON.stringify(paymentPayload),
          });
          const mpBody = await mpRes.json().catch(() => ({}));

          if (mpRes.ok && (mpBody.status === "authorized" || mpBody.status === "pending" || mpBody.status === "approved" || mpBody.status === "in_process")) {
            const expDate = new Date();
            expDate.setDate(expDate.getDate() + 7);

            await admin.from("pagamentos").update({
              gateway_payment_id: String(mpBody.id),
              autorizacao_expira_em: expDate.toISOString(),
              metadata: { ...pag.metadata, mp_auth_response: mpBody }
            } as any).eq("id", pag.id);

            await logAudit("CRON_RENOVAR_AUTORIZACAO", pag.cliente_id, {
              orcamento_id: pag.orcamento_id,
              novo_payment_id: mpBody.id
            });
            actionsTaken.push(`Renovação de autorização para orçamento ${pag.orcamento_id}`);
          } else {
             await logAudit("CRON_RENOVAR_AUTORIZACAO_FALHOU", pag.cliente_id, {
               orcamento_id: pag.orcamento_id,
               erro: mpBody
             });
             actionsTaken.push(`Falha ao renovar autorização do orçamento ${pag.orcamento_id}`);
          }
        } else {
          // Serviço JÁ OCORREU e não foi capturado
          try {
            await admin.functions.invoke("mp-recobranca-cartao", { body: { orcamento_id: pag.orcamento_id } });
            await logAudit("CRON_ACIONAR_RECOBRANCA", pag.cliente_id, {
              orcamento_id: pag.orcamento_id,
              motivo: "Autorização prestes a expirar e serviço já ocorreu"
            });
            actionsTaken.push(`Recobrança acionada para orçamento ${pag.orcamento_id} (autorização prestes a expirar)`);
          } catch (e) {
            console.error("Erro invocando recobrança", e);
          }
        }
      }
    }

    // --- PARTE 3: VERIFICAR RECOBRANÇAS PENDENTES (Tentativas falhas antes de 24h) ---
    const { data: rec_pagamentos, error: recErr } = await admin
      .from("pagamentos")
      .select("id, orcamento_id, cliente_id")
      .eq("status_autorizacao", "recobranca_pendente")
      .lte("ultima_tentativa_em", limit24hAgo);

    if (recErr) console.error("Erro ao buscar recobrancas pendentes", recErr);

    if (rec_pagamentos && rec_pagamentos.length > 0) {
      for (const pag of rec_pagamentos) {
        try {
          await admin.functions.invoke("mp-recobranca-cartao", { body: { orcamento_id: pag.orcamento_id } });
          await logAudit("CRON_RETENTAR_RECOBRANCA", pag.cliente_id, {
            orcamento_id: pag.orcamento_id
          });
          actionsTaken.push(`Retentativa de recobrança para orçamento ${pag.orcamento_id}`);
        } catch (e) {
          console.error("Erro invocando retentativa", e);
        }
      }
    }

    return json({ ok: true, executed_actions: actionsTaken });

  } catch (err: any) {
    console.error("Erro fatal cron", err);
    return json({ error: "INTERNAL", message: err?.message || "Erro interno" }, 500);
  }
});
