import type { ReactNode } from "react";
import { Clock, Eye, CheckCircle2, XCircle, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type Status = "pendente" | "em_analise" | "aprovado" | "rejeitado" | "incompleto";

export type Prestador = {
  user_id: string;
  nome: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  bio: string | null;
  especialidades: string[];
  experiencia_anos: number | null;
  como_conheceu: string | null;
  observacoes_cadastro: string | null;
  foto_documento_frente: string | null;
  foto_documento_verso: string | null;
  foto_selfie: string | null;
  aprovacao_status: Status;
  cadastro_submetido_em: string | null;
  cadastro_retomado_em: string | null;
  aprovado_em: string | null;
  motivo_rejeicao: string | null;
  cadastro_completo?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  aguardando_reenvio_admin?: boolean;
  bloqueado_em?: string | null;
  bloqueado_por?: string | null;
};

export const STATUS_CFG: Record<
  Status,
  { label: string; bg: string; text: string; icon: any; desc: string }
> = {
  pendente: {
    label: "Pendente",
    bg: "bg-slate-100",
    text: "text-slate-600",
    icon: Clock,
    desc: "Aguardando início da análise",
  },
  em_analise: {
    label: "Em análise",
    bg: "bg-amber-50",
    text: "text-amber-700",
    icon: Eye,
    desc: "Em revisão pelo admin",
  },
  aprovado: {
    label: "Aprovado",
    bg: "bg-green-50",
    text: "text-green-700",
    icon: CheckCircle2,
    desc: "Cadastros liberados",
  },
  rejeitado: {
    label: "Rejeitado",
    bg: "bg-red-50",
    text: "text-red-700",
    icon: XCircle,
    desc: "Cadastros recusados",
  },
  incompleto: {
    label: "Incompleto",
    bg: "bg-orange-50",
    text: "text-orange-700",
    icon: UserX,
    desc: "Faltam dados do prestador",
  },
};

export async function getSignedUrl(publicUrl: string | null) {
  if (!publicUrl) return null;
  try {
    const parts = publicUrl.split("/documentos-profissionais/");
    if (parts.length < 2) return publicUrl;
    const path = decodeURIComponent(parts[1]);
    const { data, error } = await supabase.storage
      .from("documentos-profissionais")
      .createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error("Erro ao gerar signed URL:", error);
    return null;
  }
}

export type EtapaInfo = {
  numero: number;
  total: number;
  label: string;
  faltando: string[];
  preenchidas: string[];
};

// Descobre em qual etapa do cadastro o prestador parou (primeira etapa com
// algum campo obrigatório faltando). Retorna null se está tudo preenchido.
export function computarEtapaParou(p: any): EtapaInfo | null {
  const ETAPAS = [
    {
      label: "Dados pessoais",
      campos: [
        { key: "nome", ok: !!p.nome && p.nome !== "—" },
        { key: "CPF", ok: !!p.cpf },
        { key: "telefone", ok: !!p.telefone },
        { key: "data de nascimento", ok: !!p.data_nascimento },
      ],
    },
    {
      label: "Endereço",
      campos: [
        { key: "CEP", ok: !!p.cep },
        { key: "endereço", ok: !!p.endereco },
        { key: "número", ok: !!p.numero },
        { key: "bairro", ok: !!p.bairro },
        { key: "cidade", ok: !!p.cidade },
        { key: "estado", ok: !!p.estado },
      ],
    },
    {
      label: "Experiência",
      campos: [
        {
          key: "especialidades",
          ok: Array.isArray(p.especialidades) && p.especialidades.length > 0,
        },
        { key: "bio", ok: !!p.bio },
      ],
    },
    {
      label: "Documentos",
      campos: [
        { key: "documento (frente)", ok: !!p.foto_documento_frente },
        { key: "documento (verso)", ok: !!p.foto_documento_verso },
        { key: "selfie", ok: !!p.foto_selfie },
      ],
    },
    {
      label: "Revisão e envio",
      campos: [{ key: "envio do cadastro para análise", ok: !!p.cadastro_submetido_em }],
    },
  ];

  for (let i = 0; i < ETAPAS.length; i++) {
    const etapa = ETAPAS[i];
    const faltando = etapa.campos.filter((c) => !c.ok).map((c) => c.key);
    if (faltando.length > 0) {
      return {
        numero: i + 1,
        total: ETAPAS.length,
        label: etapa.label,
        faltando,
        preenchidas: etapa.campos.filter((c) => c.ok).map((c) => c.key),
      };
    }
  }
  return null;
}

export function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pendente;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5 mb-3">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-3">{children}</div>;
}

export function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">
        {value || <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

export function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{label}</p>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-slate-50 text-sm"
      />
    </div>
  );
}
