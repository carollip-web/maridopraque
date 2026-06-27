import { Orcamento } from "./types";

export const STATUS_META: Record<Orcamento["status"], { label: string; className: string }> = {
  customizado_pendente: {
    label: "Aguardando seu orçamento",
    className: "bg-amber-100 text-amber-800",
  },
  enviado: { label: "Enviado ao cliente", className: "bg-sky-100 text-sky-800" },
  fixo_auto: { label: "Preço fixo", className: "bg-slate-100 text-slate-700" },
  aprovado: { label: "Agendado", className: "bg-indigo-100 text-indigo-700" },
  aguardando_pagamento: {
    label: "Aguardando pagamento do cliente",
    className: "bg-amber-100 text-amber-700",
  },
  pago: { label: "Pagamento confirmado", className: "bg-emerald-100 text-emerald-700" },
  concluido: { label: "Concluído", className: "bg-slate-100 text-slate-700" },
  recusado: { label: "Recusado", className: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelado", className: "bg-slate-200 text-slate-600" },
  em_disputa: { label: "Em disputa", className: "bg-rose-100 text-rose-700" },
  disputa_resolvida: { label: "Disputa resolvida", className: "bg-slate-100 text-slate-700" },
};

export const SUPPORT_MAILTO =
  "mailto:contato@maridopraque.com?subject=Suporte%20para%20profissional";

import type { ProfissionalTab } from "./types";

export const TAB_TITLES: Record<ProfissionalTab, string> = {
  pedidos: "Visão Geral",
  orcamentos: "Pedidos e Orçamentos",
  servicos: "Meus Serviços",
  agenda: "Agenda",
  financeiro: "Financeiro",
  avaliacoes: "Avaliações",
  configuracoes: "Configurações",
  mensagens: "Mensagens",
  notificacoes: "Notificações",
};
