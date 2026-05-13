/**
 * Stub de integração com marketplace de materiais.
 * Para conectar Mercado Livre, Leroy Merlin ou outro marketplace real,
 * substitua o corpo de fetchMarketplacePrice por uma chamada autenticada
 * (a chave de API será solicitada no momento da integração).
 *
 * Por enquanto retorna o preço base com pequena variação simulada,
 * marcando a fonte como "marketplace" para fins de auditoria.
 */
export type MarketplaceQuote = {
  preco: number;
  fonte: "marketplace";
  url?: string;
};

export async function fetchMarketplacePrice(
  nome: string,
  precoBase: number,
  marketplaceUrl?: string | null,
): Promise<MarketplaceQuote> {
  // Simulação determinística: variação ±15% baseada no nome
  const seed = Array.from(nome).reduce((s, c) => s + c.charCodeAt(0), 0);
  const factor = 0.85 + (seed % 30) / 100; // 0.85 .. 1.14
  const preco = Math.round(precoBase * factor * 100) / 100;
  return {
    preco: Math.max(0.5, preco),
    fonte: "marketplace",
    url: marketplaceUrl ?? undefined,
  };
}
