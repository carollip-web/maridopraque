import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/auditLog";
import { enviarEmailAdmin } from "@/lib/admin-email.functions";
import { enviarEmailMassaAdmin } from "@/lib/admin-email-massa.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Send,
  CheckSquare,
  Square,
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
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const sendAdminEmail = useServerFn(enviarEmailAdmin);
  const [emailDialog, setEmailDialog] = useState<{ to: string; subject: string; message: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const sendBulkEmail = useServerFn(enviarEmailMassaAdmin);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<{ subject: string; message: string; template_slug?: string } | null>(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [templates, setTemplates] = useState<Array<{ slug: string; nome: string; assunto: string }>>([]);
  const [emailTemplateSlug, setEmailTemplateSlug] = useState<string>("admin_contato");
  const [alteracoes, setAlteracoes] = useState<Array<{
    id: string;
    campo: string;
    valor_antigo: string | null;
    valor_novo: string | null;
    alterado_por_role: string | null;
    origem: string;
    created_at: string;
  }>>([]);


  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("email_templates")
        .select("slug, nome, assunto, ativo")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      setTemplates((data ?? []) as any);
    })();
  }, []);

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
    setEditMode(false);
    // Carrega histórico de alterações
    (async () => {
      if (!selected) {
        setAlteracoes([]);
        return;
      }
      const { data } = await supabase
        .from("profissional_perfil_alteracoes")
        .select("id, campo, valor_antigo, valor_novo, alterado_por_role, origem, created_at")
        .eq("profissional_user_id", selected.user_id)
        .order("created_at", { ascending: false })
        .limit(100);
      setAlteracoes((data as any) ?? []);
    })();
  }, [selected]);

  const startEdit = () => {
    if (!selected) return;
    setEditForm({
      nome: selected.nome === "—" ? "" : selected.nome ?? "",
      cpf: selected.cpf ?? "",
      data_nascimento: selected.data_nascimento ?? "",
      telefone: selected.telefone ?? "",
      cep: selected.cep ?? "",
      endereco: selected.endereco ?? "",
      numero: selected.numero ?? "",
      complemento: selected.complemento ?? "",
      bairro: selected.bairro ?? "",
      cidade: selected.cidade ?? "",
      estado: selected.estado ?? "",
      especialidades: (selected.especialidades ?? []).join(", "),
      experiencia_anos:
        selected.experiencia_anos != null ? String(selected.experiencia_anos) : "",
      bio: selected.bio ?? "",
      observacoes_cadastro: selected.observacoes_cadastro ?? "",
    });
    setEditMode(true);
  };

  const FIELD_LABELS: Record<string, string> = {
    nome: "Nome",
    cpf: "CPF",
    data_nascimento: "Data de nascimento",
    telefone: "Telefone",
    cep: "CEP",
    endereco: "Endereço",
    numero: "Número",
    complemento: "Complemento",
    bairro: "Bairro",
    cidade: "Cidade",
    estado: "Estado",
    especialidades: "Especialidades",
    experiencia_anos: "Anos de experiência",
    bio: "Biografia",
    observacoes_cadastro: "Observações",
  };

  const handleSaveEdit = async () => {
    if (!selected || !user) return;
    setSavingEdit(true);
    try {
      const novosEspecialidades = String(editForm.especialidades || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const perfilPayload: Record<string, any> = {
        cpf: editForm.cpf || null,
        data_nascimento: editForm.data_nascimento || null,
        telefone: editForm.telefone || null,
        cep: editForm.cep || null,
        endereco: editForm.endereco || null,
        numero: editForm.numero || null,
        complemento: editForm.complemento || null,
        bairro: editForm.bairro || null,
        cidade: editForm.cidade || null,
        estado: editForm.estado || null,
        especialidades: novosEspecialidades,
        experiencia_anos: editForm.experiencia_anos
          ? Number(editForm.experiencia_anos)
          : null,
        bio: editForm.bio || null,
        observacoes_cadastro: editForm.observacoes_cadastro || null,
      };

      // Diff campo a campo
      const formatar = (v: any) =>
        v == null || v === "" ? "" : Array.isArray(v) ? v.join(", ") : String(v);
      const diffs: Array<{ campo: string; antigo: string; novo: string }> = [];
      for (const k of Object.keys(perfilPayload)) {
        const antigo = formatar((selected as any)[k]);
        const novo = formatar(perfilPayload[k]);
        if (antigo !== novo) diffs.push({ campo: k, antigo, novo });
      }
      if (editForm.nome && editForm.nome !== selected.nome) {
        diffs.push({ campo: "nome", antigo: selected.nome ?? "", novo: editForm.nome });
      }

      if (diffs.length === 0) {
        toast.info("Nenhuma alteração detectada");
        setEditMode(false);
        setSavingEdit(false);
        return;
      }

      // Aplica + marca aguardando reenvio
      const { error: e1 } = await supabase
        .from("profissional_perfil")
        .update({
          ...perfilPayload,
          aguardando_reenvio_admin: true,
          bloqueado_em: new Date().toISOString(),
          bloqueado_por: user.id,
        })
        .eq("user_id", selected.user_id);
      if (e1) throw e1;

      if (editForm.nome) {
        const { error: e2 } = await supabase
          .from("profiles")
          .update({ nome: editForm.nome })
          .eq("id", selected.user_id);
        if (e2) throw e2;
      }

      // Registra histórico campo a campo
      const rows = diffs.map((d) => ({
        profissional_user_id: selected.user_id,
        campo: d.campo,
        valor_antigo: d.antigo,
        valor_novo: d.novo,
        alterado_por: user.id,
        alterado_por_role: "admin",
        origem: "admin",
      }));
      await supabase.from("profissional_perfil_alteracoes").insert(rows);

      // Notifica profissional in-app
      await supabase.from("notificacoes").insert({
        user_id: selected.user_id,
        titulo: "Seu cadastro foi atualizado pela equipe",
        mensagem:
          "A equipe ajustou " +
          diffs.length +
          " campo(s) do seu cadastro (" +
          diffs
            .slice(0, 3)
            .map((d) => FIELD_LABELS[d.campo] ?? d.campo)
            .join(", ") +
          (diffs.length > 3 ? "…" : "") +
          "). Revise e reenvie para validação.",
        link: "/profissional-cadastro",
        lida: false,
      });

      await logAdminAction(supabase, {
        acao: "profissional_editado_admin",
        detalhes: { campos: diffs.map((d) => d.campo), total: diffs.length },
        entidadeTipo: "profissional",
        entidadeId: selected.user_id,
      });

      toast.success("Dados atualizados", {
        description: "Validação bloqueada até o profissional reenviar.",
      });
      setEditMode(false);
      setSelected({
        ...selected,
        ...perfilPayload,
        nome: editForm.nome || selected.nome,
        aguardando_reenvio_admin: true,
        bloqueado_em: new Date().toISOString(),
      } as Prestador);
      refresh();
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err?.message });
    } finally {
      setSavingEdit(false);
    }
  };


  const handleUploadDoc = async (
    field: "foto_documento_frente" | "foto_documento_verso" | "foto_selfie",
    file: File,
  ) => {
    if (!selected) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB)");
      return;
    }
    setUploadingField(field);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${field}-admin-${Date.now()}.${ext}`;
      const path = `${selected.user_id}/${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("documentos-profissionais")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from("documentos-profissionais")
        .getPublicUrl(path);

      const updatePayload: Record<string, string> = {};
      updatePayload[field] = pub.publicUrl;
      const { error: dbErr } = await supabase
        .from("profissional_perfil")
        .update(updatePayload as any)
        .eq("user_id", selected.user_id);

      if (dbErr) throw dbErr;

      await logAdminAction(supabase, {
        acao: "profissional_documento_atualizado_admin",
        detalhes: { campo: field },
        entidadeTipo: "profissional",
        entidadeId: selected.user_id,
      });

      const updated = { ...selected, [field]: pub.publicUrl } as Prestador;
      setSelected(updated);
      const signed = await getSignedUrl(pub.publicUrl);
      setSignedUrls((s) => ({
        ...s,
        frente: field === "foto_documento_frente" ? signed : s.frente,
        verso: field === "foto_documento_verso" ? signed : s.verso,
        selfie: field === "foto_selfie" ? signed : s.selfie,
      }));
      toast.success("Documento atualizado");
      refresh();
    } catch (err: any) {
      toast.error("Erro ao enviar documento", { description: err?.message });
    } finally {
      setUploadingField(null);
    }
  };



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
    <>
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
            {/* Bulk toolbar */}
            {filtered.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-2.5 shadow-sm flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = filtered.every((p) => selectedIds.has(p.user_id));
                    const next = new Set(selectedIds);
                    if (allSelected) filtered.forEach((p) => next.delete(p.user_id));
                    else filtered.forEach((p) => next.add(p.user_id));
                    setSelectedIds(next);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-50"
                >
                  {filtered.every((p) => selectedIds.has(p.user_id)) ? (
                    <CheckSquare className="h-3.5 w-3.5 text-brand" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  Selecionar todos ({filtered.length})
                </button>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado(s)</span>
                  )}
                  <Button
                    size="sm"
                    className="rounded-full text-xs gap-1.5 bg-brand text-brand-foreground"
                    disabled={selectedIds.size === 0}
                    onClick={() =>
                      setBulkDialog({
                        subject: "",
                        message:
                          "Olá {{nome}},\n\nNotamos que seu cadastro está em {{etapa}}.\n\nFaltam: {{campos_faltantes}}\n\nFinalize em: " +
                          "https://maridopraque.lovable.app/profissional-cadastro\n\nAbraços,\nEquipe Marido pra Quê",
                      })
                    }
                  >
                    <Send className="h-3 w-3" />
                    Enviar e-mail em massa
                  </Button>
                </div>
              </div>
            )}
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
                <div
                  key={p.user_id}
                  className={`w-full text-left bg-white rounded-2xl border p-4 transition-all hover:shadow-sm flex gap-3 ${selected?.user_id === p.user_id ? "border-brand ring-2 ring-brand/20" : "border-slate-200"}`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = new Set(selectedIds);
                      if (next.has(p.user_id)) next.delete(p.user_id);
                      else next.add(p.user_id);
                      setSelectedIds(next);
                    }}
                    className="shrink-0 mt-0.5"
                    aria-label="Selecionar"
                  >
                    {selectedIds.has(p.user_id) ? (
                      <CheckSquare className="h-4 w-4 text-brand" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(p)}
                    className="flex-1 min-w-0 text-left"
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
                  {p.cadastro_retomado_em && (
                    <p className="text-[10px] mt-2 font-semibold text-amber-700 inline-flex items-center gap-1">
                      <RotateCcw className="h-3 w-3" />
                      Retomou em {new Date(p.cadastro_retomado_em).toLocaleDateString("pt-BR")}
                      {" "}às {new Date(p.cadastro_retomado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  {p.cadastro_submetido_em && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Enviado em {new Date(p.cadastro_submetido_em).toLocaleDateString("pt-BR")}
                    </p>
                  )}

                  </button>
                </div>
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
                    {selected.aguardando_reenvio_admin && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <RotateCcw className="h-3 w-3" /> Aguardando reenvio
                      </span>
                    )}
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
                    {!editMode ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs gap-1.5"
                        onClick={startEdit}
                      >
                        <Pencil className="h-3 w-3" /> Editar dados
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="rounded-full text-xs gap-1.5 bg-brand text-brand-foreground"
                          onClick={handleSaveEdit}
                          disabled={savingEdit}
                        >
                          {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-xs gap-1.5"
                          onClick={() => setEditMode(false)}
                          disabled={savingEdit}
                        >
                          <X className="h-3 w-3" /> Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Atividade do prestador (datas-chave) */}
                <div className="px-6 py-3 bg-slate-50 border-b border-border flex flex-wrap gap-4 text-xs">
                  {selected.cadastro_submetido_em && (
                    <span className="text-slate-600">
                      <span className="font-semibold">Enviado:</span>{" "}
                      {new Date(selected.cadastro_submetido_em).toLocaleString("pt-BR")}
                    </span>
                  )}
                  {selected.cadastro_retomado_em && (
                    <span className="text-amber-700 inline-flex items-center gap-1 font-semibold">
                      <RotateCcw className="h-3 w-3" />
                      Retomou em {new Date(selected.cadastro_retomado_em).toLocaleString("pt-BR")}
                    </span>
                  )}
                  {selected.updated_at && (
                    <span className="text-slate-600">
                      <span className="font-semibold">Última edição:</span>{" "}
                      {new Date(selected.updated_at).toLocaleString("pt-BR")}
                    </span>
                  )}
                  {(() => {
                    const et = computarEtapaParou(selected);
                    if (!et || selected.aprovacao_status === "aprovado") return null;
                    return (
                      <span className="text-orange-700 font-semibold">
                        Etapa atual: {et.numero}/{et.total} — {et.label}
                      </span>
                    );
                  })()}
                </div>


                <div className="p-6 space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {!editMode ? (
                    <>
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
                    </>
                  ) : (
                    <Section title="Editar dados do prestador" icon={Pencil}>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <EditField label="Nome completo" value={editForm.nome} onChange={(v) => setEditForm({ ...editForm, nome: v })} />
                        <EditField label="CPF" value={editForm.cpf} onChange={(v) => setEditForm({ ...editForm, cpf: v })} />
                        <EditField label="Data de nascimento" type="date" value={editForm.data_nascimento} onChange={(v) => setEditForm({ ...editForm, data_nascimento: v })} />
                        <EditField label="Telefone" value={editForm.telefone} onChange={(v) => setEditForm({ ...editForm, telefone: v })} />
                        <EditField label="CEP" value={editForm.cep} onChange={(v) => setEditForm({ ...editForm, cep: v })} />
                        <EditField label="Endereço" value={editForm.endereco} onChange={(v) => setEditForm({ ...editForm, endereco: v })} />
                        <EditField label="Número" value={editForm.numero} onChange={(v) => setEditForm({ ...editForm, numero: v })} />
                        <EditField label="Complemento" value={editForm.complemento} onChange={(v) => setEditForm({ ...editForm, complemento: v })} />
                        <EditField label="Bairro" value={editForm.bairro} onChange={(v) => setEditForm({ ...editForm, bairro: v })} />
                        <EditField label="Cidade" value={editForm.cidade} onChange={(v) => setEditForm({ ...editForm, cidade: v })} />
                        <EditField label="Estado (UF)" value={editForm.estado} onChange={(v) => setEditForm({ ...editForm, estado: v })} />
                        <EditField label="Anos de experiência" type="number" value={editForm.experiencia_anos} onChange={(v) => setEditForm({ ...editForm, experiencia_anos: v })} />
                      </div>
                      <div className="mt-3">
                        <EditField label="Especialidades (separadas por vírgula)" value={editForm.especialidades} onChange={(v) => setEditForm({ ...editForm, especialidades: v })} />
                      </div>
                      <div className="mt-3">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Bio</p>
                        <textarea
                          value={editForm.bio || ""}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-slate-50 text-sm resize-none"
                        />
                      </div>
                      <div className="mt-3">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Observações</p>
                        <textarea
                          value={editForm.observacoes_cadastro || ""}
                          onChange={(e) => setEditForm({ ...editForm, observacoes_cadastro: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-slate-50 text-sm resize-none"
                        />
                      </div>
                    </Section>
                  )}


                  {/* Documents */}
                  <Section title="Documentos" icon={FileText}>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {[
                        { label: "Doc. Frente", field: "foto_documento_frente" as const, url: signedUrls.frente },
                        { label: "Doc. Verso", field: "foto_documento_verso" as const, url: signedUrls.verso },
                        { label: "Selfie", field: "foto_selfie" as const, url: signedUrls.selfie },
                      ].map(({ label, field, url }) => (
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
                          <label className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-brand cursor-pointer hover:underline">
                            {uploadingField === field ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" /> Enviando…
                              </>
                            ) : (
                              <>
                                <Upload className="h-3 w-3" /> {url ? "Substituir" : "Enviar"}
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              disabled={uploadingField === field}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadDoc(field, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
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
                          <button
                            type="button"
                            onClick={() => {
                              const primeiro = selected.nome?.split(" ")[0] || "";
                              const etapaTxt = etapa?.label || "final";
                              setEmailDialog({
                                to: selected.email,
                                subject: `Vamos finalizar seu cadastro na Marido pra Quê?`,
                                message: `Olá ${primeiro},\n\nVimos que seu cadastro como prestador na Marido pra Quê parou na etapa "${etapaTxt}". Estamos aqui para te ajudar a concluir e começar a receber oportunidades.\n\nÉ rápido — basta entrar na sua conta e continuar de onde parou.\n\nQualquer dúvida, é só responder este e-mail.\n\nEquipe Marido pra Quê`,
                              });
                            }}
                            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline text-left"
                          >
                            <Mail className="h-4 w-4" /> {selected.email}
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })()}

                  {/* Histórico de alterações */}
                  {alteracoes.length > 0 && (
                    <Section title="Histórico de alterações" icon={RotateCcw}>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {alteracoes.map((a) => (
                          <div
                            key={a.id}
                            className="text-xs p-3 rounded-lg bg-slate-50 border border-slate-200"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-slate-700">
                                {FIELD_LABELS[a.campo] ?? a.campo}
                              </span>
                              <span className="text-slate-500">
                                {new Date(a.created_at).toLocaleString("pt-BR")} ·{" "}
                                {a.alterado_por_role === "admin" ? "Admin" : "Profissional"}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="p-2 rounded bg-red-50 border border-red-100">
                                <div className="text-[10px] uppercase text-red-600 font-bold mb-0.5">
                                  Antes
                                </div>
                                <div className="text-slate-700 break-words">
                                  {a.valor_antigo || <em className="text-slate-400">vazio</em>}
                                </div>
                              </div>
                              <div className="p-2 rounded bg-green-50 border border-green-100">
                                <div className="text-[10px] uppercase text-green-700 font-bold mb-0.5">
                                  Depois
                                </div>
                                <div className="text-slate-700 break-words">
                                  {a.valor_novo || <em className="text-slate-400">vazio</em>}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Actions */}
                  {selected.aprovacao_status !== "aprovado" &&
                    selected.aprovacao_status !== "incompleto" && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      {selected.aguardando_reenvio_admin && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                          <strong>Validação bloqueada.</strong> A equipe ajustou dados deste
                          cadastro. Aguarde o profissional revisar e reenviar antes de aprovar.
                        </div>
                      )}
                      <Button
                        onClick={handleAprovar}
                        disabled={saving || !!selected.aguardando_reenvio_admin}
                        className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold gap-2 disabled:opacity-50"
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

    <Dialog open={!!emailDialog} onOpenChange={(o) => !o && setEmailDialog(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar e-mail</DialogTitle>
        </DialogHeader>
        {emailDialog && (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] uppercase font-bold text-muted-foreground mb-1">Para</p>
              <Input value={emailDialog.to} readOnly className="bg-slate-50" />
            </div>
            <div>
              <p className="text-[11px] uppercase font-bold text-muted-foreground mb-1">Template</p>
              <Select
                value={emailTemplateSlug}
                onValueChange={(v) => {
                  setEmailTemplateSlug(v);
                  const tpl = templates.find((t) => t.slug === v);
                  if (tpl && emailDialog) {
                    setEmailDialog({ ...emailDialog, subject: tpl.assunto || emailDialog.subject });
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_contato">Padrão (admin_contato)</SelectItem>
                  {templates.filter((t) => t.slug !== "admin_contato").map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[11px] uppercase font-bold text-muted-foreground mb-1">Assunto</p>
              <Input
                value={emailDialog.subject}
                onChange={(e) => setEmailDialog({ ...emailDialog, subject: e.target.value })}
              />
            </div>
            <div>
              <p className="text-[11px] uppercase font-bold text-muted-foreground mb-1">Mensagem</p>
              <Textarea
                rows={10}
                value={emailDialog.message}
                onChange={(e) => setEmailDialog({ ...emailDialog, message: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Envio direto de contato@maridopraque.com via Gmail.
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setEmailDialog(null)} disabled={sendingEmail}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (!emailDialog) return;
              setSendingEmail(true);
              try {
                const res = await sendAdminEmail({ data: { ...emailDialog, template_slug: emailTemplateSlug } });
                if (res?.ok) {
                  toast.success("E-mail enviado");
                  setEmailDialog(null);
                } else {
                  toast.error(res?.error || "Falha ao enviar");
                }
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Falha ao enviar";
                toast.error(msg);
              } finally {
                setSendingEmail(false);
              }
            }}
            disabled={sendingEmail || !emailDialog?.subject.trim() || !emailDialog?.message.trim()}
          >
            {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Bulk email dialog */}
    <Dialog open={!!bulkDialog} onOpenChange={(o) => !o && setBulkDialog(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar e-mail em massa</DialogTitle>
        </DialogHeader>
        {bulkDialog && (() => {
          const recipients = prestadores.filter((p) => selectedIds.has(p.user_id) && p.email && p.email !== "—");
          return (
            <div className="space-y-3">
              <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="font-semibold mb-1">{recipients.length} destinatário(s)</p>
                <p className="text-muted-foreground">
                  Um e-mail individual será enviado para cada um (não aparece como lista). Throttle ~1,5/s.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1">Assunto</p>
                <Input
                  value={bulkDialog.subject}
                  onChange={(e) => setBulkDialog({ ...bulkDialog, subject: e.target.value })}
                  placeholder="Ex: Falta pouco para concluir seu cadastro"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold">Mensagem</p>
                  <div className="flex gap-1 flex-wrap">
                    {["{{nome}}", "{{etapa}}", "{{campos_faltantes}}"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setBulkDialog({ ...bulkDialog, message: (bulkDialog.message || "") + " " + v })
                        }
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 font-mono"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  rows={10}
                  value={bulkDialog.message}
                  onChange={(e) => setBulkDialog({ ...bulkDialog, message: e.target.value })}
                />
              </div>
            </div>
          );
        })()}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setBulkDialog(null)} disabled={sendingBulk}>
            Cancelar
          </Button>
          <Button
            className="bg-brand text-brand-foreground"
            disabled={
              sendingBulk ||
              !bulkDialog?.subject.trim() ||
              !bulkDialog?.message.trim() ||
              selectedIds.size === 0
            }
            onClick={async () => {
              if (!bulkDialog) return;
              const recipients = prestadores
                .filter((p) => selectedIds.has(p.user_id) && p.email && p.email !== "—")
                .map((p) => {
                  const et = computarEtapaParou(p);
                  return {
                    email: p.email,
                    nome: p.nome || "",
                    etapa: et ? `${et.numero}/${et.total} — ${et.label}` : "—",
                    campos_faltantes: et ? et.faltando.join(", ") : "—",
                  };
                });
              if (recipients.length === 0) {
                toast.error("Nenhum destinatário válido");
                return;
              }
              if (recipients.length > 20) {
                if (!confirm(`Enviar para ${recipients.length} destinatários?`)) return;
              }
              setSendingBulk(true);
              try {
                const res = await sendBulkEmail({
                  data: {
                    subject: bulkDialog.subject,
                    message: bulkDialog.message,
                    recipients,
                  },
                });
                if (res?.ok) {
                  toast.success(`${res.sent} enviado(s)`, {
                    description: res.failed > 0 ? `${res.failed} falha(s)` : undefined,
                  });
                  setBulkDialog(null);
                  setSelectedIds(new Set());
                } else {
                  toast.error(res?.error || "Falha ao enviar");
                }
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Falha ao enviar");
              } finally {
                setSendingBulk(false);
              }
            }}
          >
            {sendingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : `Enviar para ${selectedIds.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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

function EditField({
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
