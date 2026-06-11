export const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export const statusLabel: Record<string, { label: string; cls: string }> = {
  customizado_pendente: {
    label: "Aguardando proposta",
    cls: "bg-amber-50 text-amber-700",
  },
  fixo_auto: { label: "Aguardando aprovação", cls: "bg-blue-50 text-blue-700" },
  enviado: { label: "Aguardando aprovação", cls: "bg-blue-50 text-blue-700" },
  aprovado: {
    label: "Aguardando pagamento",
    cls: "bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm",
  },
  recusado: { label: "Recusado", cls: "bg-red-50 text-red-700" },
  pago: { label: "Pagamento confirmado", cls: "bg-green-50 text-green-700" },
  cancelado: { label: "Cancelado", cls: "bg-slate-50 text-slate-700" },
};

export const ROUTE_HEAD_META = [
  { title: "Meus Orçamentos — Solicitar online | Marido pra Quê?" },
  {
    name: "description",
    content:
      "Solicite orçamento online em 5 etapas: escolha o serviço, atendimento, agenda, materiais opcionais e confirme.",
  },
  { property: "og:title", content: "Orçamento online — Marido pra Quê?" },
  {
    property: "og:description",
    content:
      "Preço tabelado, atendimento, agenda e acompanhamento em tempo real.",
  },
];
