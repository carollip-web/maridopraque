import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";

export const Route = createFileRoute("/admin-validacao")({
  component: AdminValidacao,
});

type Status = "pendente" | "em_analise" | "aprovado" | "rejeitado";

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
};

const STATUS_CFG: Record<Status, { label: string; bg: string; text: string; icon: any }> = {
  pendente: { label: "Pendente", bg: "bg-slate-100", text: "text-slate-600", icon: Clock },
  em_analise: { label: "Em análise", bg: "bg-amber-50", text: "text-amber-700", icon: Eye },
  aprovado: { label: "Aprovado", bg: "bg-green-50", text: "text-green-700", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", bg: "bg-red-50", text: "text-red-700", icon: XCircle },
};

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
      (perfis ?? [])
        .filter((p: any) => p.cadastro_completo || p.aprovacao_status !== "pendente")
        .map((p: any) => ({
          ...p,
          nome: profileMap[p.user_id]?.nome || "—",
          email: profileMap[p.user_id]?.email || "—",
        })),
    );
    setLoadingList(false);
  };

  useEffect(() => {
    if (user && isAdmin) refresh();
  }, [user, isAdmin]);

  const handleAprovar = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await (supabase.from("profissional_perfil") as any)
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
    const { error } = await (supabase.from("profissional_perfil") as any)
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
    toast.success("Cadastro rejeitado. Prestador notificado.");
    setMotivo("");
    setSelected(null);
    refresh();
  };

  const handleMarcarAnalise = async (p: Prestador) => {
    await (supabase.from("profissional_perfil") as any)
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
    pendente: prestadores.filter((p) => p.aprovacao_status === "pendente").length,
    aprovado: prestadores.filter((p) => p.aprovacao_status === "aprovado").length,
    rejeitado: prestadores.filter((p) => p.aprovacao_status === "rejeitado").length,
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

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {(["em_analise", "pendente", "aprovado", "rejeitado"] as const).map((s) => {
            const cfg = STATUS_CFG[s];
            const Icon = cfg.icon;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s === filterStatus ? "todos" : s)}
                className={`p-4 rounded-2xl border text-left transition-all ${filterStatus === s ? "border-brand ring-2 ring-brand/20" : "border-slate-200 bg-white"}`}
              >
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center mb-2 ${cfg.bg}`}
                >
                  <Icon className={`h-4 w-4 ${cfg.text}`} />
                </div>
                <p className="text-2xl font-bold">{counts[s]}</p>
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
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
                        { label: "Doc. Frente", url: selected.foto_documento_frente },
                        { label: "Doc. Verso", url: selected.foto_documento_verso },
                        { label: "Selfie", url: selected.foto_selfie },
                      ].map(({ label, url }) => (
                        <div key={label}>
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            {label}
                          </p>
                          {url ? (
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

                  {/* Actions */}
                  {(selected.aprovacao_status as string) !== "aprovado" && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      {selected.aprovacao_status !== "aprovado" && (
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
                      )}
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
