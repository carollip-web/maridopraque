import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const cancelarComSplitSchema = z.object({
  orcamentoId: z.string().uuid(),
  motivo: z.string().trim().max(500).optional(),
});

function errorMessage(e: unknown): string | undefined {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return undefined;
}

/** Lê um número opcional de um payload Json sem usar `any`. */
function readNumber(payload: Json | null | undefined, key: string): number {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const v = (payload as { [k: string]: Json | undefined })[key];
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

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
    if (orcErr || !orc) return { ok: false as const, error: "Pedido não encontrado" };
    if (orc.cliente_id !== userId) return { ok: false as const, error: "Sem permissão" };

    const rpcRes = (await supabase.rpc(
      "cancelar_orcamento_com_split" as never,
      { _orcamento_id: data.orcamentoId, _motivo: data.motivo || null, _origem: "cliente" } as never,
    )) as unknown as { data: Json | null; error: PostgrestError | null };
    const { data: rpcData, error: rpcErr } = rpcRes;
    if (rpcErr) {
      console.error("[cancelarPedidoComSplit] RPC fail", rpcErr);
      return { ok: false as const, error: rpcErr.message };
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
      const refundJson = (await res.json().catch(() => ({}))) as Json;
      console.info("[cancelarPedidoComSplit] estorno result", res.status, refundJson);
      return { ok: true as const, regra: rpcData, estorno: refundJson };
    } catch (e: unknown) {
      const msg = errorMessage(e);
      console.warn("[cancelarPedidoComSplit] estorno falhou:", msg);
      return { ok: true as const, regra: rpcData, estornoErro: msg };
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

    const rpcRes = (await supabase.rpc("resolver_disputa_orcamento" as never, {
      _orcamento_id: data.orcamentoId,
      _pct_prestador: data.pctPrestador,
      _pct_plataforma: data.pctPlataforma,
      _motivo: data.motivo || null,
    } as never)) as unknown as { data: Json | null; error: PostgrestError | null };
    const { data: rpcData, error } = rpcRes;
    if (error) return { ok: false as const, error: error.message };

    // Estorno se houve reembolso
    try {
      const reemb = readNumber(rpcData, "valor_reembolso");
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
    } catch (e: unknown) {
      console.warn("[resolverDisputaOrcamento] estorno falhou:", errorMessage(e));
    }

    return { ok: true as const, resultado: rpcData };
  });
