import { Orcamento } from "./types";

export const STATUS_META: Record<Orcamento["status"], { label: string; className: string }> = {
  customizado_pendente: {
    label: "Aguardando seu orçamento",
    className: "bg-amber-100 text-amber-800",
  },
  enviado: { label: "Enviado ao cliente", className: "bg-sky-100 text-sky-800" },
  fixo_auto: { label: "Preço fixo", className: "bg-slate-100 text-slate-700" },
  aprovado: { label: "Aguardando Pagamento", className: "bg-amber-100 text-amber-800" },
  pago: { label: "Agendado — em execução", className: "bg-emerald-600 text-white" },
  concluido: { label: "Concluído", className: "bg-indigo-600 text-white" },
  recusado: { label: "Recusado", className: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelado", className: "bg-slate-200 text-slate-600" },
};

export const WHATSAPP_LINK = "https://wa.me/5521999999999?text=Olá!%20Sou%20profissional%20do%20Marido%20Pra%20Quê.";
