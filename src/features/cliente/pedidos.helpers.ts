// Helpers puros usados pela aba de Pedidos do cliente.

export const gerarPdfOrcamento = (id: string) =>
  import("@/lib/pdf-orcamento").then((m) => m.gerarPdfOrcamento(id));

export const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Normaliza um nome de serviço para servir de chave de lookup no catálogo
// (minúsculas, sem acentos, sem espaços nas pontas).
export const catalogNameKey = (name: string | null | undefined) =>
  `name:${String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()}`;
