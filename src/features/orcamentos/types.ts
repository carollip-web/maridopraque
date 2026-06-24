export type Servico = {
  id: string;
  nome: string;
  categoria: string;
  preco_min: number | null;
  preco_max: number | null;
};

export type Material = {
  id: string;
  nome: string;
  unidade: string;
  preco_atual: number;
  preco_fonte: string;
};

export type ServiceMaterial = {
  service_id: string;
  material_id: string;
  quantidade_sugerida: number;
};

export type OrcamentoRow = {
  id: string;
  service_id: string | null;
  service_name: string;
  descricao: string | null;
  valor: number | null;
  valor_servico: number | null;
  taxa_material: number;
  status: string;
  auto_aprovado: boolean;
  observacoes_profissional: string | null;
  tipo_atendimento: string | null;
  metragem_m2: number | null;
  created_at: string;
};


export type OrcMaterial = {
  id: string;
  orcamento_id: string;
  material_id: string;
  nome_snapshot: string;
  unidade_snapshot: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface OrcamentoDraft {
  selServiceId?: string;
  descricao?: string;
  tipoAtendimento?: string;
  dataPreferida?: string;
  periodoPreferido?: string;
  horarioPreferido?: string;
  flexibilidadeAgenda?: string;
  picked?: Record<string, number>;
  metragemM2?: string;
  step?: WizardStep;
}

