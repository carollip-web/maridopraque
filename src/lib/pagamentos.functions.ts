import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutSchema = z.object({
  orcamentoId: z.string().uuid(),
});

export const iniciarPagamentoOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => checkoutSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Buscar orçamento e validar posse/status
    // Usamos any para evitar erros de tipagem com o join orcamento_materiais
    const { data: orc, error: e1 } = await supabase
      .from("orcamentos")
      .select("*, orcamento_materiais(*)")
      .eq("id", data.orcamentoId)
      .single() as any;

    if (e1 || !orc) {
      console.error("[iniciarPagamentoOrcamento] Orçamento não encontrado:", data.orcamentoId);
      throw new Error("Orçamento não encontrado.");
    }
    
    if (orc.cliente_id !== userId) {
      console.warn("[iniciarPagamentoOrcamento] Tentativa de acesso não autorizado por:", userId);
      throw new Error("Sem permissão para este orçamento.");
    }
    
    // Status pagáveis: 'aprovado' (quando aceitou proposta), 'fixo_auto'
    const statusPagaveis = ["aprovado", "fixo_auto"];
    if (!statusPagaveis.includes(orc.status)) {
      throw new Error(`Orçamento em status "${orc.status}" não está pronto para pagamento.`);
    }

    // 2. Calcular valores no servidor (Fonte de verdade)
    const valorServico = Number(orc.valor_servico || 0);
    const valorMateriais = (orc.orcamento_materiais || []).reduce(
      (acc: number, m: any) => acc + Number(m.preco_unitario || 0) * Number(m.quantidade || 0),
      0
    );
    const valorTotal = valorServico + valorMateriais;
    
    // Regra: 50% de sinal sobre o total
    const valorSinal = valorTotal * 0.5;
    const valorRestante = valorTotal - valorSinal;

    if (valorTotal <= 0) {
      throw new Error("O valor total do orçamento deve ser maior que zero para iniciar o pagamento.");
    }

    // 3. Verificar se já existe pagamento pendente para evitar duplicidade
    const { data: existing } = await supabase
      .from("pagamentos")
      .select("id, status")
      .eq("orcamento_id", data.orcamentoId)
      .in("status", ["pending", "checkout_created"])
      .maybeSingle();

    if (existing) {
      console.info("[iniciarPagamentoOrcamento] Reutilizando pagamento existente:", existing.id);
      return { 
        ok: true, 
        pagamentoId: existing.id, 
        message: "Checkout online em implantação. Nenhuma cobrança real foi realizada." 
      };
    }

    // 4. Criar registro de pagamento (Preparação para Gateway)
    const { data: pag, error: e2 } = await supabase
      .from("pagamentos")
      .insert({
        orcamento_id: orc.id,
        cliente_id: userId,
        profissional_id: orc.profissional_id,
        valor_total: valorTotal,
        valor_sinal: valorSinal,
        valor_restante: valorRestante,
        status: "checkout_created",
        gateway: "mercado_pago",
        metadata: {
          service_name: orc.service_name,
          initiated_at: new Date().toISOString()
        }
      })
      .select()
      .single() as any;

    if (e2) {
      console.error("[iniciarPagamentoOrcamento] Erro ao inserir pagamento:", e2);
      throw new Error(`Erro ao criar pagamento: ${e2.message}`);
    }

    console.info(`[iniciarPagamentoOrcamento] Checkout iniciado: Pedido=${orc.id}, User=${userId}, Sinal=R$${valorSinal.toFixed(2)}`);

    return { 
      ok: true, 
      pagamentoId: pag.id,
      message: "Checkout online em implantação. Nenhuma cobrança real foi realizada."
    };
  });
