import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cancelarComSplitSchema = z.object({
  orcamentoId: z.string().uuid(),
  motivo: z.string().trim().max(500).optional(),
});

/**
 * Cancela um pedido JÁ PAGO aplicando as regras de split/multa/reembolso
 * (cancelar_orcamento_com_split) e dispara o estorno no gateway.
 */
export const cancelarPedidoComSplit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cancelarComSplitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: orc, error: orcErr } = await supabase
      .from("orcamentos")
      .select("id, cliente_id, status")
      .eq("id", data.orcamentoId)
      .single();
    if (orcErr || !orc) return { ok: false, error: "Pedido não encontrado" };
    if (orc.cliente_id !== userId) return { ok: false, error: "Sem permissão" };

    const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
      "cancelar_orcamento_com_split",
      { _orcamento_id: data.orcamentoId, _motivo: data.motivo || null, _origem: "cliente" },
    );
    if (rpcErr) {
      console.error("[cancelarPedidoComSplit] RPC fail", rpcErr);
      return { ok: false, error: rpcErr.message };
    }

    // Dispara estorno no gateway (best-effort)
    try {
      const url = `${process.env.SUPABASE_URL}/functions/v1/processar-estorno`;
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ orcamentoId: data.orcamentoId }),
      });
      const refundJson = await res.json().catch(() => ({}));
      console.info("[cancelarPedidoComSplit] estorno result", res.status, refundJson);
      return { ok: true, regra: rpcData, estorno: refundJson };
    } catch (e: any) {
      console.warn("[cancelarPedidoComSplit] estorno falhou:", e?.message);
      return { ok: true, regra: rpcData, estornoErro: e?.message };
    }
  });

const resolverDisputaSchema = z.object({
  orcamentoId: z.string().uuid(),
  pctPrestador: z.number().min(0).max(100),
  pctPlataforma: z.number().min(0).max(100),
  motivo: z.string().trim().max(1000).optional(),
});

/** Admin resolve disputa manualmente. */
export const resolverDisputaOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => resolverDisputaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: rpcData, error } = await (supabase as any).rpc("resolver_disputa_orcamento", {
      _orcamento_id: data.orcamentoId,
      _pct_prestador: data.pctPrestador,
      _pct_plataforma: data.pctPlataforma,
      _motivo: data.motivo || null,
    });
    if (error) return { ok: false, error: error.message };

    // Estorno se houve reembolso
    try {
      const reemb = Number((rpcData as any)?.valor_reembolso || 0);
      if (reemb > 0) {
        const url = `${process.env.SUPABASE_URL}/functions/v1/processar-estorno`;
        const session = (await supabase.auth.getSession()).data.session;
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ orcamentoId: data.orcamentoId }),
        });
      }
    } catch (e: any) {
      console.warn("[resolverDisputaOrcamento] estorno falhou:", e?.message);
    }

    return { ok: true, resultado: rpcData };
  });
