export interface Orcamento {
  id: string;
  cliente_id: string;
  profissional_id: string | null;
  service_id: string | null;
  service_name: string;
  descricao: string | null;
  valor: number | null;
  valor_servico: number | null;
  taxa_material: number;
  status:
    | "fixo_auto"
    | "customizado_pendente"
    | "enviado"
    | "aprovado"
    | "recusado"
    | "pago"
    | "concluido"
    | "cancelado"
    | "em_disputa"
    | "disputa_resolvida";
  observacoes_profissional: string | null;
  created_at: string;
  updated_at: string;
  data_aprovacao: string | null;
  data_pagamento: string | null;
  data_agendada?: string | null;
  auto_aprovado: boolean;
  fotos_problema: string[] | null;
  fotos_concluido: string[] | null;
  checkin_em?: string | null;
  checkout_em?: string | null;
  tipo_atendimento?: string | null;
  data_preferida?: string | null;
  periodo_preferido?: string | null;
  horario_preferido?: string | null;
  flexibilidade_agenda?: string | null;
  genero?: string | null;
  oferece_apoio_feminino?: boolean | null;
}

export type GeneroProfissional = "homem" | "mulher" | "outro" | "nao_informar";

export type ServicoCat = {
  id: string;
  preco_min: number | null;
  preco_max: number | null;
  categoria?: string;
};
export type OrcMat = {
  orcamento_id: string;
  nome_snapshot: string;
  unidade_snapshot: string;
  quantidade: number;
  subtotal: number;
};
export type ClienteGeo = { lat: number | null; lng: number | null; cidade: string | null };
export type Profile = { id: string; nome: string; whatsapp: string | null; email: string | null };

export type ProfissionalTab =
  | "pedidos"
  | "orcamentos"
  | "servicos"
  | "agenda"
  | "financeiro"
  | "avaliacoes"
  | "configuracoes"
  | "mensagens"
  | "notificacoes";
