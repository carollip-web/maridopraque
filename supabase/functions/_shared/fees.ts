// supabase/functions/_shared/fees.ts
// ------------------------------------------------------------------
// Fonte única da verdade para o cálculo de taxas do marketplace.
//
// Usado pelo checkout transparente (mercadopago-cartao-processar) e
// pelo webhook (mercado-pago-webhook) para garantir que o split, a
// comissão e o adicional de apoio sejam calculados de forma idêntica
// nos dois lugares. Antes essas constantes viviam duplicadas em cada
// função (uma como 15, outra como 0.15), o que abria espaço para
// divergência silenciosa.
// ------------------------------------------------------------------

/** Comissão do marketplace sobre o valor base do serviço (15%). */
export const MARKETPLACE_FEE = 0.15;

/** Adicional cobrado quando o atendimento exige apoio feminino (30% sobre a base). */
export const APOIO_SURCHARGE = 0.3;

/** Arredonda para 2 casas decimais (centavos), evitando ruído de ponto flutuante. */
export function round2(valor: number): number {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

export interface ValoresPagamento {
  /** Valor base do serviço (serviço + materiais), arredondado em centavos. */
  valorBase: number;
  /** Adicional de apoio feminino (0 quando não se aplica). */
  valorApoio: number;
  /** Valor total cobrado do cliente (base + apoio). */
  valorTotal: number;
  /** Comissão do marketplace sobre a base (15%). */
  marketplaceFee: number;
  /** application_fee enviado ao Mercado Pago = comissão + apoio. */
  applicationFee: number;
  /** Valor líquido repassado ao profissional (base - comissão). */
  valorProfissional: number;
}

/**
 * Calcula todos os valores do pagamento a partir do valor BASE do serviço
 * (serviço + materiais, sem o adicional de apoio).
 *
 * Use no momento de criar o pagamento (checkout transparente), quando
 * partimos do valor do serviço para montar o total e o application_fee.
 */
export function calcularValores(valorBase: number, requiresApoio: boolean): ValoresPagamento {
  const base = Number(valorBase) || 0;
  const valorApoio = requiresApoio ? round2(base * APOIO_SURCHARGE) : 0;
  const valorTotal = round2(base + valorApoio);
  const marketplaceFee = round2(base * MARKETPLACE_FEE);
  const applicationFee = round2(marketplaceFee + valorApoio);
  const valorProfissional = round2(base * (1 - MARKETPLACE_FEE));
  return {
    valorBase: round2(base),
    valorApoio,
    valorTotal,
    marketplaceFee,
    applicationFee,
    valorProfissional,
  };
}

/**
 * Recupera o valor base a partir do valor TOTAL já cobrado.
 *
 * Use quando só temos o total da transação (ex.: o webhook lendo o
 * pagamento aprovado no Mercado Pago). O apoio é sempre 30% sobre a
 * base, logo o total = base * (1 + APOIO_SURCHARGE) quando há apoio.
 */
export function valorBaseDeTotal(valorTotal: number, requiresApoio: boolean): number {
  const apoioFactor = requiresApoio ? 1 + APOIO_SURCHARGE : 1;
  return round2((Number(valorTotal) || 0) / apoioFactor);
}
