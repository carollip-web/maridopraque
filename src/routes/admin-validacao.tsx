import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/auditLog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  User,
  MapPin,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  AlertTriangle,
  Shield,
  UserX,
  Phone,
  Mail,
  Pencil,
  Upload,
  X,
  Save,
  RotateCcw,
}  from "lucide-react";


export const Route = createFileRoute("/admin-validacao")({
  component: AdminValidacao,
});

type Status = "pendente" | "em_analise" | "aprovado" | "rejeitado" | "incompleto";

type Prestador = {
  user_id: string;
  nome: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  cidade: string | null;
  estado: string | null;
  endereco: string | null;
  numero: string | null;
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
  aprovado_em: string | null;
  motivo_rejeicao: string | null;
  cadastro_completo?: boolean;
  created_at?: string | null;
};

const STATUS_CFG: Record<Status, { label: string; bg: string; text: string; icon: any; desc: string }> = {
  pendente: { label: "Pendente", bg: "bg-slate-100", text: "text-slate-600", icon: Clock, desc: "Aguardando início da análise" },
  em_analise: { label: "Em análise", bg: "bg-amber-50", text: "text-amber-700", icon: Eye, desc: "Em revisão pelo admin" },
  aprovado: { label: "Aprovado", bg: "bg-green-50", text: "text-green-700", icon: CheckCircle2, desc: "Cadastros liberados" },
  rejeitado: { label: "Rejeitado", bg: "bg-red-50", text: "text-red-700", icon: XCircle, desc: "Cadastros recusados" },
  incompleto: { label: "Incompleto", bg: "bg-orange-50", text: "text-orange-700", icon: UserX, desc: "Faltam dados do prestador" },
};

async function getSignedUrl(publicUrl: string | null) {
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

type EtapaInfo = {
  numero: number;
  total: number;
  label: string;
  faltando: string[];
  preenchidas: string[];
};

function computarEtapaParou(p: any): EtapaInfo | null {
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
        { key: "especialidades", ok: Array.isArray(p.especialidades) && p.especialidades.length > 0 },
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

function StatusBadge({ status }: { status: Status }) {
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

function AdminValidacao() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<Prestador | null>(null);
  const [signedUrls, setSignedUrls] = useState<{ frente: string | null; verso: string | null; selfie: string | null }>({ frente: null, verso: null, selfie: null });
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status | "todos">("em_analise");
  const [search, setSearch] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const refresh = async () => {
    setLoadingList(true);
    const { data: perfis } = await supabase
      .from("profissional_perfil")
      .select("*")
      .order("cadastro_submetido_em", { ascending: false });

    const ids = (perfis ?? []).map((p: any) => p.user_id);
    const { data: profiles } =
      ids.length > 0
        ? await supabase.from("profiles").select("id, nome, email").in("id", ids)
        : { data: [] };

    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

    setPrestadores(
      (perfis ?? []).map((p: any) => {
        const isIncompleto =
          !p.cadastro_completo && p.aprovacao_status === "pendente";
        return {
          ...p,
          aprovacao_status: isIncompleto ? "incompleto" : p.aprovacao_status,
          nome: profileMap[p.user_id]?.nome || "—",
          email: profileMap[p.user_id]?.email || "—",
        };
      }),
    );
    setLoadingList(false);
  };

  useEffect(() => {
    if (user && isAdmin) refresh();
  }, [user, isAdmin]);

  useEffect(() => {
    async function fetchSignedUrls() {
      if (!selected) {
        setSignedUrls({ frente: null, verso: null, selfie: null });
        return;
      }
      setLoadingUrls(true);
      const frente = await getSignedUrl(selected.foto_documento_frente);
      const verso = await getSignedUrl(selected.foto_documento_verso);
      const selfie = await getSignedUrl(selected.foto_selfie);
      setSignedUrls({ frente, verso, selfie });
      setLoadingUrls(false);
    }
    fetchSignedUrls();
  }, [selected]);

  const handleAprovar = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("profissional_perfil")
      .update({
        aprovacao_status: "aprovado",
        ativo: true,
        aprovado_por: user?.id,
        aprovado_em: new Date().toISOString(),
        motivo_rejeicao: null,
      })
      .eq("user_id", selected.user_id);
    // grant role
    await supabase.from("user_roles").upsert({ user_id: selected.user_id, role: "profissional" });
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }

    // Atualizar o lead correspondente para "aprovado" (analytics do funil de captação)
    await supabase
      .from("profissionais_pre_cadastro")
      .update({ status: "aprovado" })
      .eq("user_id", selected.user_id);

    // Notificar o profissional que foi aprovado
    await supabase.from("notificacoes").insert({
      user_id: selected.user_id,
      titulo: "🎉 Cadastro aprovado!",
      mensagem: "Seu cadastro foi aprovado. Agora você pode receber pedidos e conectar sua conta Mercado Pago para receber pagamentos.",
      link: "/profissional",
      lida: false,
    });

    await logAdminAction(supabase, {
      acao: "profissional_aprovado",
      detalhes: { nome: selected.nome },
      entidadeTipo: "profissional",
      entidadeId: selected.user_id,
    });

    toast.success("Profissional aprovado! Acesso liberado.");
    setSelected(null);
    refresh();
  };

  const handleRejeitar = async () => {
    if (!selected) return;
    if (!motivo.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profissional_perfil")
      .update({
        aprovacao_status: "rejeitado",
        ativo: false,
        motivo_rejeicao: motivo,
      })
      .eq("user_id", selected.user_id);
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }

    await logAdminAction(supabase, {
      acao: "profissional_rejeitado",
      detalhes: { nome: selected.nome, motivo },
      entidadeTipo: "profissional",
      entidadeId: selected.user_id,
    });

    toast.success("Cadastro rejeitado. Prestador notificado.");
    setMotivo("");
    setSelected(null);
    refresh();
  };

  const handleMarcarAnalise = async (p: Prestador) => {
    await supabase.from("profissional_perfil")
      .update({ aprovacao_status: "em_analise" })
      .eq("user_id", p.user_id);
    refresh();
  };

  const filtered = prestadores.filter((p) => {
    if (filterStatus !== "todos" && p.aprovacao_status !== filterStatus) return false;
    if (
      search &&
      !p.nome.toLowerCase().includes(search.toLowerCase()) &&
      !p.email.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const counts = {
    em_analise: prestadores.filter((p) => p.aprovacao_status === "em_analise").length,
    incompleto: prestadores.filter((p) => p.aprovacao_status === "incompleto").length,
    aprovado: prestadores.filter((p) => p.aprovacao_status === "aprovado").length,
    rejeitado: prestadores.filter((p) => p.aprovacao_status === "rejeitado").length,
    pendente: prestadores.filter((p) => p.aprovacao_status === "pendente").length,
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (!isAdmin)
    return (
      <div className="max-w-md mx-auto py-32 text-center">
        <h1 className="text-2xl font-bold">Acesso restrito</h1>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <Link
              to="/admin"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar ao admin
            </Link>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Shield className="h-7 w-7 text-brand" /> Validação de Prestadores
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Analise e aprove os cadastros de prestadores de serviço.
            </p>
          </div>
          <Link to="/profissional-cadastro">
            <Button variant="outline" className="rounded-full gap-2 text-sm">
              Ver formulário de cadastro
            </Button>
          </Link>
        </div>

        {/* Stats — organizadas por fluxo: ação necessária → resolvidos */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ação necessária
          </p>
          {filterStatus !== "todos" && (
            <button
              onClick={() => setFilterStatus("todos")}
              className="text-xs text-brand hover:underline font-medium"
            >
              Limpar filtro
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {(["pendente", "em_analise"] as const).map((s) => {
            const cfg = STATUS_CFG[s];
            const Icon = cfg.icon;
            const active = filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s === filterStatus ? "todos" : s)}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${active ? "border-brand ring-2 ring-brand/20 bg-white" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <Icon className={`h-5 w-5 ${cfg.text}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">{counts[s]}</p>
                    <p className="text-sm font-semibold">{cfg.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{cfg.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Histórico
        </p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(["incompleto", "aprovado", "rejeitado"] as const).map((s) => {
            const cfg = STATUS_CFG[s];
            const Icon = cfg.icon;
            const active = filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s === filterStatus ? "todos" : s)}
                className={`p-3 rounded-2xl border text-left transition-all ${active ? "border-brand ring-2 ring-brand/20 bg-white" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">{cfg.label}</p>
                </div>
                <p className="text-xl font-bold">{counts[s]}</p>
              </button>
            );
          })}
        </div>


        <div className="grid lg:grid-cols-5 gap-6">
          {/* List */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex gap-2">
              <Search className="h-4 w-4 text-muted-foreground self-center ml-1" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar prestador..."
                className="flex-1 text-sm bg-transparent outline-none"
              />
            </div>
            {loadingList ? (
              <div className="py-12 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                <User className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum cadastro encontrado.</p>
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => setSelected(p)}
                  className={`w-full text-left bg-white rounded-2xl border p-4 transition-all hover:shadow-sm ${selected?.user_id === p.user_id ? "border-brand ring-2 ring-brand/20" : "border-slate-200"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </div>
                    <StatusBadge status={p.aprovacao_status} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.especialidades.slice(0, 3).map((e: string) => (
                      <span
                        key={e}
                        className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium"
                      >
                        {e}
                      </span>
                    ))}
                    {p.especialidades.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{p.especialidades.length - 3}
                      </span>
                    )}
                  </div>
                  {p.aprovacao_status === "incompleto" && (() => {
                    const et = computarEtapaParou(p);
                    if (!et) return null;
                    return (
                      <p className="text-[10px] mt-2 font-semibold text-orange-700">
                        Parou na etapa {et.numero}/{et.total}: {et.label}
                      </p>
                    );
                  })()}
                  {p.cadastro_submetido_em && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Enviado em {new Date(p.cadastro_submetido_em).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Detail */}
          <div className="lg:col-span-3">
            {!selected ? (
              <div className="py-24 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                <Shield className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium text-sm">
                  Selecione um cadastro para analisar.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Detail header */}
                <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{selected.nome}</h2>
                    <p className="text-sm text-muted-foreground">{selected.email}</p>
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <StatusBadge status={selected.aprovacao_status} />
                    {selected.aprovacao_status === "pendente" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                        onClick={() => handleMarcarAnalise(selected)}
                      >
                        Iniciar análise
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {/* Personal info */}
                  <Section title="Dados pessoais" icon={User}>
                    <Grid2>
                      <Field label="CPF" value={selected.cpf} />
                      <Field
                        label="Nascimento"
                        value={
                          selected.data_nascimento
                            ? new Date(selected.data_nascimento).toLocaleDateString("pt-BR")
                            : null
                        }
                      />
                      <Field label="Telefone" value={selected.telefone} />
                      <Field
                        label="Experiência"
                        value={
                          selected.experiencia_anos ? `${selected.experiencia_anos} anos` : null
                        }
                      />
                    </Grid2>
                  </Section>

                  {/* Address */}
                  <Section title="Endereço" icon={MapPin}>
                    <Field
                      label="Endereço completo"
                      value={[
                        selected.endereco,
                        selected.numero,
                        selected.bairro,
                        selected.cidade,
                        selected.estado,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    />
                  </Section>

                  {/* Experience */}
                  <Section title="Experiência" icon={FileText}>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {selected.especialidades.map((e) => (
                        <span
                          key={e}
                          className="text-xs bg-brand/10 text-brand px-2.5 py-1 rounded-full font-medium"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                    {selected.bio && (
                      <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-4">
                        {selected.bio}
                      </p>
                    )}
                    {selected.observacoes_cadastro && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {selected.observacoes_cadastro}
                      </p>
                    )}
                  </Section>

                  {/* Documents */}
                  <Section title="Documentos" icon={FileText}>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {[
                        { label: "Doc. Frente", url: signedUrls.frente, original: selected.foto_documento_frente },
                        { label: "Doc. Verso", url: signedUrls.verso, original: selected.foto_documento_verso },
                        { label: "Selfie", url: signedUrls.selfie, original: selected.foto_selfie },
                      ].map(({ label, url, original }) => (
                        <div key={label}>
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            {label}
                          </p>
                          {loadingUrls ? (
                            <div className="w-full h-28 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={url}
                                alt={label}
                                className="w-full h-28 object-cover rounded-xl border border-border hover:opacity-80 transition-opacity"
                                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                              <p className="text-xs text-brand font-medium mt-1">Ver completo ↗</p>
                            </a>
                          ) : (
                            <div className="w-full h-28 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                              <AlertTriangle className="h-4 w-4 text-amber-400" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>

                  {/* Rejection info */}
                  {selected.motivo_rejeicao && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                      <p className="text-xs font-bold uppercase text-red-700 mb-1">
                        Motivo da rejeição anterior
                      </p>
                      <p className="text-sm text-red-800">{selected.motivo_rejeicao}</p>
                    </div>
                  )}

                  {/* Incompleto: contato para cobrança */}
                  {selected.aprovacao_status === "incompleto" && (() => {
                    const etapa = computarEtapaParou(selected);
                    return (
                    <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 space-y-3">
                      <p className="text-sm font-bold text-orange-800">
                        Cadastro não finalizado
                      </p>
                      {etapa ? (
                        <div className="bg-white/70 rounded-lg p-3 border border-orange-200 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase text-orange-700">
                              Parou na etapa {etapa.numero} de {etapa.total}
                            </p>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                              {etapa.numero - 1}/{etapa.total} concluídas
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800">
                            {etapa.label}
                          </p>
                          {etapa.faltando.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                                Falta preencher
                              </p>
                              <ul className="text-xs text-slate-700 list-disc list-inside space-y-0.5">
                                {etapa.faltando.map((f) => (
                                  <li key={f}>{f}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-orange-700">
                          Todos os dados foram preenchidos, mas o profissional ainda não enviou o cadastro para análise.
                        </p>
                      )}
                      <p className="text-xs text-orange-700">
                        Entre em contato para ajudar a finalizar:
                      </p>
                      <div className="flex flex-col gap-2">
                        {selected.telefone && (
                          <a
                            href={`https://wa.me/55${selected.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Olá ${selected.nome?.split(" ")[0] || ""}! Vimos que seu cadastro na Mestres do Lar parou na etapa "${etapa?.label || "final"}". Posso te ajudar a finalizar?`,
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:underline"
                          >
                            <Phone className="h-4 w-4" /> {selected.telefone} (WhatsApp)
                          </a>
                        )}
                        {selected.email && selected.email !== "—" && (
                          <a
                            href={`mailto:${selected.email}`}
                            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                          >
                            <Mail className="h-4 w-4" /> {selected.email}
                          </a>
                        )}
                      </div>
                    </div>
                    );
                  })()}

                  {/* Actions */}
                  {selected.aprovacao_status !== "aprovado" &&
                    selected.aprovacao_status !== "incompleto" && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <Button
                        onClick={handleAprovar}
                        disabled={saving}
                        className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold gap-2"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}{" "}
                        Aprovar prestador
                      </Button>
                      <div className="space-y-2">
                        <textarea
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          rows={2}
                          placeholder="Motivo da rejeição (obrigatório para rejeitar)..."
                          className="w-full px-4 py-3 rounded-xl border border-border bg-slate-50 text-sm resize-none"
                        />
                        <Button
                          onClick={handleRejeitar}
                          disabled={saving || !motivo.trim()}
                          variant="outline"
                          className="w-full border-red-300 text-red-600 hover:bg-red-50 rounded-xl font-bold gap-2"
                        >
                          <XCircle className="h-4 w-4" /> Rejeitar cadastro
                        </Button>
                      </div>
                    </div>
                  )}
                  {selected.aprovacao_status === "aprovado" && (
                    <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800 font-medium">
                      ✓ Aprovado em{" "}
                      {selected.aprovado_em
                        ? new Date(selected.aprovado_em).toLocaleDateString("pt-BR")
                        : "—"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
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

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">
        {value || <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}
