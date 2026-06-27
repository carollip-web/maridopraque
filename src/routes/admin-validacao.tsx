import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/auditLog";
import { enviarEmailAdmin } from "@/lib/admin-email.functions";
import { enviarEmailMassaAdmin } from "@/lib/admin-email-massa.functions";
import {
  getEmailConfirmStatus,
  reenviarConfirmacaoEmail,
} from "@/lib/admin-auth-actions.functions";
import { excluirUsuarioAdmin } from "@/lib/usuarios.functions";
import { ContatoBadge } from "@/components/ContatoBadge";
import { WhatsappContatoDialog } from "@/components/WhatsappContatoDialog";
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
  User,
  MapPin,
  FileText,
  Search,
  AlertTriangle,
  Shield,
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
  ArrowUpDown,
  Info,
  Trash2,
} from "lucide-react";
import {
  type Status,
  type Prestador,
  STATUS_CFG,
  getSignedUrl,
  computarEtapaParou,
  StatusBadge,
  Section,
  Grid2,
  Field,
  EditField,
} from "@/features/admin/admin-validacao.helpers";

export const Route = createFileRoute("/admin-validacao")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (typeof search.tab === "string" ? search.tab : undefined) as
      "todos" | "pendente" | "em_analise" | "incompleto" | "aprovado" | "rejeitado" | undefined,
    id: typeof search.id === "string" ? (search.id as string) : undefined,
    sort: (typeof search.sort === "string" ? search.sort : undefined) as
      "recente" | "nome" | "etapa" | undefined,
    etapa: (typeof search.etapa === "string" ? search.etapa : undefined) as
      "1" | "2" | "3" | "4" | "5" | undefined,
    email_nao_confirmado:
      search.email_nao_confirmado === true || search.email_nao_confirmado === "true",
  }),
  component: AdminValidacao,
});

function AdminValidacao() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<Prestador | null>(null);
  const [signedUrls, setSignedUrls] = useState<{
    frente: string | null;
    verso: string | null;
    selfie: string | null;
  }>({ frente: null, verso: null, selfie: null });
  const [loadingUrls, setLoadingUrls] = useState(false);
  const searchParams = Route.useSearch();
  const [filterStatus, setFilterStatus] = useState<Status | "todos">(
    searchParams.tab ?? "em_analise",
  );
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recente" | "nome" | "etapa">(
    searchParams.sort ?? "recente",
  );
  const [filterEtapa, setFilterEtapa] = useState<"" | "1" | "2" | "3" | "4" | "5">(
    searchParams.etapa ?? "",
  );
  const [filterEmailNaoConfirmado, setFilterEmailNaoConfirmado] = useState(
    searchParams.email_nao_confirmado ?? false,
  );
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const sendAdminEmail = useServerFn(enviarEmailAdmin);
  const [emailDialog, setEmailDialog] = useState<{
    to: string;
    subject: string;
    message: string;
  } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const sendBulkEmail = useServerFn(enviarEmailMassaAdmin);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<{
    subject: string;
    message: string;
    template_slug?: string;
  } | null>(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{ slug: string; nome: string; assunto: string }>
  >([]);
  const [emailTemplateSlug, setEmailTemplateSlug] = useState<string>("admin_contato");
  const [whatsDialog, setWhatsDialog] = useState<{
    open: boolean;
    userId: string | null;
    email: string | null;
    telefone: string;
    nome: string | null;
    mensagem: string;
  } | null>(null);
  const [contatoRefresh, setContatoRefresh] = useState(0);
  const [alteracoes, setAlteracoes] = useState<
    Array<{
      id: string;
      campo: string;
      valor_antigo: string | null;
      valor_novo: string | null;
      alterado_por_role: string | null;
      origem: string;
      created_at: string;
    }>
  >([]);
  const fetchConfirmStatus = useServerFn(getEmailConfirmStatus);
  const resendConfirm = useServerFn(reenviarConfirmacaoEmail);
  const [emailConfirmados, setEmailConfirmados] = useState<Record<string, boolean>>({});
  const [resendingConfirm, setResendingConfirm] = useState(false);
  const excluirUsuarioFn = useServerFn(excluirUsuarioAdmin);
  const [deleteTarget, setDeleteTarget] = useState<Prestador | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

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
        ? await supabase.from("profiles").select("id, nome, email, whatsapp").in("id", ids)
        : { data: [] };

    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

    setPrestadores(
      (perfis ?? []).map((p: any) => {
        const isIncompleto = !p.cadastro_completo && p.aprovacao_status === "pendente";
        const prof = profileMap[p.user_id];
        return {
          ...p,
          aprovacao_status: isIncompleto ? "incompleto" : p.aprovacao_status,
          nome: prof?.nome || "—",
          email: prof?.email || "—",
          telefone: p.telefone || prof?.whatsapp || null,
          experiencia_anos: p.experiencia_anos ?? p.anos_experiencia ?? null,
        };
      }),
    );
    setLoadingList(false);

    // Load email confirmation status for incomplete/pending users
    const idsParaChecar = (perfis ?? [])
      .filter((p: any) => !p.cadastro_completo || p.aprovacao_status === "pendente")
      .map((p: any) => p.user_id);
    if (idsParaChecar.length > 0) {
      try {
        const r = await fetchConfirmStatus({ data: { userIds: idsParaChecar } });
        if (r?.ok) setEmailConfirmados(r.confirmados);
      } catch (e) {
        console.warn("Falha ao checar confirmação de e-mail", e);
      }
    }
  };

  const handleReenviarConfirmacao = async (uid: string) => {
    setResendingConfirm(true);
    try {
      const r = await resendConfirm({ data: { userId: uid } });
      if (r.ok) {
        toast.success("E-mail de confirmação reenviado");
      } else {
        toast.error(r.error || "Falha ao reenviar");
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao reenviar");
    } finally {
      setResendingConfirm(false);
    }
  };

  const handleExcluirCadastro = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim().toUpperCase() !== "EXCLUIR") {
      toast.error('Digite "EXCLUIR" para confirmar');
      return;
    }
    setDeletingAccount(true);
    try {
      const r = await excluirUsuarioFn({ data: { targetUserId: deleteTarget.user_id } });
      if (!(r as any)?.ok) throw new Error("Falha ao excluir");
      await logAdminAction(supabase, {
        acao: "profissional_excluido_validacao",
        detalhes: {
          nome: deleteTarget.nome,
          email: deleteTarget.email,
          status: deleteTarget.aprovacao_status,
        },
        entidadeTipo: "profissional",
        entidadeId: deleteTarget.user_id,
      });
      toast.success("Cadastro excluído permanentemente");
      if (selected?.user_id === deleteTarget.user_id) setSelected(null);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      refresh();
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e?.message });
    } finally {
      setDeletingAccount(false);
    }
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
      nome: selected.nome === "—" ? "" : (selected.nome ?? ""),
      cpf: selected.cpf ?? "",
      data_nascimento: selected.data_nascimento
        ? String(selected.data_nascimento).slice(0, 10)
        : "",
      telefone: selected.telefone ?? "",
      cep: selected.cep ?? "",
      endereco: selected.endereco ?? "",
      numero: selected.numero ?? "",
      complemento: selected.complemento ?? "",
      bairro: selected.bairro ?? "",
      cidade: selected.cidade ?? "",
      estado: selected.estado ?? "",
      especialidades: (selected.especialidades ?? []).join(", "),
      experiencia_anos: selected.experiencia_anos != null ? String(selected.experiencia_anos) : "",
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
        experiencia_anos: editForm.experiencia_anos ? Number(editForm.experiencia_anos) : null,
        bio: editForm.bio || null,
        observacoes_cadastro: editForm.observacoes_cadastro || null,
      };

      // Diff campo a campo
      const formatar = (v: any) =>
        v == null || v === "" ? "" : Array.isArray(v) ? v.join(", ") : String(v);
      const diffs: Array<{ campo: string; antigo: string; novo: string }> = [];
      for (const k of Object.keys(perfilPayload)) {
        const antigo = formatar(selected[k as keyof Prestador]);
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

      const { data: pub } = supabase.storage.from("documentos-profissionais").getPublicUrl(path);

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
    const { error } = await supabase
      .from("profissional_perfil")
      .update({
        aprovacao_status: "aprovado",
        ativo: true,
        aprovado_por: user?.id,
        aprovado_em: new Date().toISOString(),
        motivo_rejeicao: null,
        aguardando_reenvio_admin: false,
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

    // A notificação de aprovação (e o e-mail correspondente) é disparada
    // automaticamente pelo trigger tr_notify_profissional_approval ao mudar
    // aprovacao_status para 'aprovado'. Não inserir manualmente para evitar
    // duplicidade de e-mails.


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
    const { error } = await supabase
      .from("profissional_perfil")
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
    await supabase
      .from("profissional_perfil")
      .update({ aprovacao_status: "em_analise" })
      .eq("user_id", p.user_id);
    refresh();
  };

  const filtered = prestadores
    .filter((p) => {
      if (filterStatus !== "todos" && p.aprovacao_status !== filterStatus) return false;
      if (
        search &&
        !p.nome.toLowerCase().includes(search.toLowerCase()) &&
        !p.email.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (filterEtapa) {
        const et = computarEtapaParou(p);
        if (!et || String(et.numero) !== filterEtapa) return false;
      }
      if (filterEmailNaoConfirmado) {
        if (emailConfirmados[p.user_id] !== false) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "nome") return (a.nome ?? "").localeCompare(b.nome ?? "");
      if (sortBy === "etapa") {
        const ea = computarEtapaParou(a)?.numero ?? 999;
        const eb = computarEtapaParou(b)?.numero ?? 999;
        if (ea !== eb) return ea - eb;
      }
      const ta = new Date(a.updated_at ?? a.cadastro_submetido_em ?? 0).getTime();
      const tb = new Date(b.updated_at ?? b.cadastro_submetido_em ?? 0).getTime();
      return tb - ta;
    });

  const counts = {
    em_analise: prestadores.filter((p) => p.aprovacao_status === "em_analise").length,
    incompleto: prestadores.filter((p) => p.aprovacao_status === "incompleto").length,
    aprovado: prestadores.filter((p) => p.aprovacao_status === "aprovado").length,
    rejeitado: prestadores.filter((p) => p.aprovacao_status === "rejeitado").length,
    pendente: prestadores.filter((p) => p.aprovacao_status === "pendente").length,
  };

  // Sync URL <-> state (tab, sort, id)
  useEffect(() => {
    navigate({
      to: "/admin-validacao",
      search: {
        tab: filterStatus === "em_analise" ? undefined : filterStatus,
        sort: sortBy === "recente" ? undefined : sortBy,
        id: selected?.user_id,
        etapa: filterEtapa || undefined,
        email_nao_confirmado: filterEmailNaoConfirmado || undefined,
      },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, sortBy, selected?.user_id, filterEtapa, filterEmailNaoConfirmado]);

  // Pre-select prestador from URL once list loads
  useEffect(() => {
    if (selected || !searchParams.id || prestadores.length === 0) return;
    const found = prestadores.find((p) => p.user_id === searchParams.id);
    if (found) setSelected(found as Prestador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prestadores, searchParams.id]);

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
                search={{ tab: "profissionais" }}
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

          {/* Compact sticky tab bar */}
          <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-5 bg-slate-50/85 backdrop-blur border-b border-slate-200">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {(
                ["todos", "em_analise", "pendente", "incompleto", "aprovado", "rejeitado"] as const
              ).map((s) => {
                const active = filterStatus === s;
                const label = s === "todos" ? "Todos" : STATUS_CFG[s as Status].label;
                const n = s === "todos" ? prestadores.length : counts[s as Status];
                const isAction = s === "em_analise" || s === "pendente";
                return (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      active
                        ? "bg-brand text-brand-foreground border-brand shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {label}
                    <span
                      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                        active
                          ? "bg-white/25 text-white"
                          : isAction && n > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-6 items-start">
            {/* List */}
            <div className="lg:col-span-2 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1 space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-1">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar prestador..."
                    className="flex-1 text-sm bg-transparent outline-none py-1"
                  />
                </div>
                <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "recente" | "nome" | "etapa")}
                    className="text-xs bg-transparent outline-none font-medium text-slate-700 pr-1"
                    aria-label="Ordenar"
                  >
                    <option value="recente">Mais recentes</option>
                    <option value="nome">Nome (A–Z)</option>
                    <option value="etapa">Etapa</option>
                  </select>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 px-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    Etapa:
                  </span>
                  <select
                    value={filterEtapa}
                    onChange={(e) =>
                      setFilterEtapa(e.target.value as "" | "1" | "2" | "3" | "4" | "5")
                    }
                    className="text-xs bg-transparent outline-none font-medium text-slate-700 pr-1"
                    aria-label="Filtrar por etapa"
                  >
                    <option value="">Todas</option>
                    <option value="1">1 — Dados pessoais</option>
                    <option value="2">2 — Endereço</option>
                    <option value="3">3 — Experiência</option>
                    <option value="4">4 — Documentos</option>
                    <option value="5">5 — Revisão e envio</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                  <button
                    type="button"
                    onClick={() => setFilterEmailNaoConfirmado((v: boolean) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                      filterEmailNaoConfirmado
                        ? "bg-red-50 text-red-700 border-red-300"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Mail className="h-3 w-3" />
                    E-mail não confirmado
                    {filterEmailNaoConfirmado && <X className="h-3 w-3" />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground px-1">
                {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
              </p>
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
                      <span className="text-xs text-muted-foreground">
                        {selectedIds.size} selecionado(s)
                      </span>
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
                      {p.aprovacao_status === "incompleto" &&
                        (() => {
                          const et = computarEtapaParou(p);
                          if (!et) return null;
                          return (
                            <p className="text-[10px] mt-2 font-semibold text-orange-700">
                              Parou na etapa {et.numero}/{et.total}: {et.label}
                            </p>
                          );
                        })()}
                      {emailConfirmados[p.user_id] === false && (
                        <p className="text-[10px] mt-2 font-semibold text-red-700 inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          E-mail não confirmado
                        </p>
                      )}
                      {p.cadastro_retomado_em && (
                        <p className="text-[10px] mt-2 font-semibold text-amber-700 inline-flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" />
                          Retomou em {new Date(p.cadastro_retomado_em).toLocaleDateString(
                            "pt-BR",
                          )}{" "}
                          às{" "}
                          {new Date(p.cadastro_retomado_em).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      {p.cadastro_submetido_em && (
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Enviado em {new Date(p.cadastro_submetido_em).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </button>
                    <div
                      className="pt-2 mt-2 border-t border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ContatoBadge
                        userId={p.user_id}
                        email={p.email && p.email !== "—" ? p.email : null}
                        nome={p.nome}
                        refreshKey={contatoRefresh}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Detail */}
            <div className="lg:col-span-3 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
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
                  <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
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
                      {emailConfirmados[selected.user_id] === false && (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                            <Mail className="h-3 w-3" /> E-mail não confirmado
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => handleReenviarConfirmacao(selected.user_id)}
                            disabled={resendingConfirm}
                          >
                            {resendingConfirm ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            Reenviar confirmação
                          </Button>
                        </>
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
                            {savingEdit ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
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
                      {!editMode && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setDeleteTarget(selected);
                            setDeleteConfirmText("");
                          }}
                        >
                          <Trash2 className="h-3 w-3" /> Excluir cadastro
                        </Button>
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
                                  ? (() => {
                                      const s = String(selected.data_nascimento).slice(0, 10);
                                      const [y, m, d] = s.split("-");
                                      return y && m && d ? `${d}/${m}/${y}` : s;
                                    })()
                                  : null
                              }
                            />
                            <Field label="Telefone" value={selected.telefone} />
                            <Field
                              label="Experiência"
                              value={
                                selected.experiencia_anos
                                  ? `${selected.experiencia_anos} anos`
                                  : null
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
                          <EditField
                            label="Nome completo"
                            value={editForm.nome}
                            onChange={(v) => setEditForm({ ...editForm, nome: v })}
                          />
                          <EditField
                            label="CPF"
                            value={editForm.cpf}
                            onChange={(v) => setEditForm({ ...editForm, cpf: v })}
                          />
                          <EditField
                            label="Data de nascimento"
                            type="date"
                            value={editForm.data_nascimento}
                            onChange={(v) => setEditForm({ ...editForm, data_nascimento: v })}
                          />
                          <EditField
                            label="Telefone"
                            value={editForm.telefone}
                            onChange={(v) => setEditForm({ ...editForm, telefone: v })}
                          />
                          <EditField
                            label="CEP"
                            value={editForm.cep}
                            onChange={(v) => setEditForm({ ...editForm, cep: v })}
                          />
                          <EditField
                            label="Endereço"
                            value={editForm.endereco}
                            onChange={(v) => setEditForm({ ...editForm, endereco: v })}
                          />
                          <EditField
                            label="Número"
                            value={editForm.numero}
                            onChange={(v) => setEditForm({ ...editForm, numero: v })}
                          />
                          <EditField
                            label="Complemento"
                            value={editForm.complemento}
                            onChange={(v) => setEditForm({ ...editForm, complemento: v })}
                          />
                          <EditField
                            label="Bairro"
                            value={editForm.bairro}
                            onChange={(v) => setEditForm({ ...editForm, bairro: v })}
                          />
                          <EditField
                            label="Cidade"
                            value={editForm.cidade}
                            onChange={(v) => setEditForm({ ...editForm, cidade: v })}
                          />
                          <EditField
                            label="Estado (UF)"
                            value={editForm.estado}
                            onChange={(v) => setEditForm({ ...editForm, estado: v })}
                          />
                          <EditField
                            label="Anos de experiência"
                            type="number"
                            value={editForm.experiencia_anos}
                            onChange={(v) => setEditForm({ ...editForm, experiencia_anos: v })}
                          />
                        </div>
                        <div className="mt-3">
                          <EditField
                            label="Especialidades (separadas por vírgula)"
                            value={editForm.especialidades}
                            onChange={(v) => setEditForm({ ...editForm, especialidades: v })}
                          />
                        </div>
                        <div className="mt-3">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                            Bio
                          </p>
                          <textarea
                            value={editForm.bio || ""}
                            onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-slate-50 text-sm resize-none"
                          />
                        </div>
                        <div className="mt-3">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                            Observações
                          </p>
                          <textarea
                            value={editForm.observacoes_cadastro || ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, observacoes_cadastro: e.target.value })
                            }
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-slate-50 text-sm resize-none"
                          />
                        </div>
                      </Section>
                    )}

                    {/* Documents */}
                    <Section title="Documentos" icon={FileText}>
                      {!signedUrls.frente &&
                        !signedUrls.verso &&
                        !signedUrls.selfie &&
                        !loadingUrls && (
                          <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800">
                              Este prestador ainda não enviou nenhum documento.
                            </p>
                          </div>
                        )}
                      <div className="grid sm:grid-cols-3 gap-3">
                        {[
                          {
                            label: "Doc. Frente",
                            field: "foto_documento_frente" as const,
                            url: signedUrls.frente,
                          },
                          {
                            label: "Doc. Verso",
                            field: "foto_documento_verso" as const,
                            url: signedUrls.verso,
                          },
                          {
                            label: "Selfie",
                            field: "foto_selfie" as const,
                            url: signedUrls.selfie,
                          },
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
                                <p className="text-xs text-brand font-medium mt-1">
                                  Ver completo ↗
                                </p>
                              </a>
                            ) : (
                              <div className="w-full h-28 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1">
                                <AlertTriangle className="h-4 w-4 text-amber-400" />
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  Não enviado
                                </span>
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
                    {selected.aprovacao_status === "incompleto" &&
                      (() => {
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
                                Todos os dados foram preenchidos, mas o profissional ainda não
                                enviou o cadastro para análise.
                              </p>
                            )}
                            <p className="text-xs text-orange-700">
                              Entre em contato para ajudar a finalizar:
                            </p>
                            <div className="flex flex-col gap-2">
                              {selected.telefone && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWhatsDialog({
                                      open: true,
                                      userId: selected.user_id,
                                      email:
                                        selected.email && selected.email !== "—"
                                          ? selected.email
                                          : null,
                                      telefone: selected.telefone as string,
                                      nome: selected.nome ?? null,
                                      mensagem: `Olá ${selected.nome?.split(" ")[0] || ""}! Vimos que seu cadastro na Marido pra Quê parou na etapa "${etapa?.label || "final"}". Posso te ajudar a finalizar?`,
                                    });
                                  }}
                                  className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:underline text-left"
                                >
                                  <Phone className="h-4 w-4" /> {selected.telefone} (WhatsApp)
                                </button>
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
                              <strong>Atenção:</strong> a equipe ajustou dados deste cadastro. O
                              ideal é aguardar o profissional revisar e reenviar, mas você pode
                              aprovar mesmo assim se já validou as mudanças.
                            </div>
                          )}
                          <Button
                            onClick={handleAprovar}
                            disabled={saving}
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
                <p className="text-[11px] uppercase font-bold text-muted-foreground mb-1">
                  Template
                </p>
                <Select
                  value={emailTemplateSlug}
                  onValueChange={(v) => {
                    setEmailTemplateSlug(v);
                    const tpl = templates.find((t) => t.slug === v);
                    if (tpl && emailDialog) {
                      setEmailDialog({
                        ...emailDialog,
                        subject: tpl.assunto || emailDialog.subject,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin_contato">Padrão (admin_contato)</SelectItem>
                    {templates
                      .filter((t) => t.slug !== "admin_contato")
                      .map((t) => (
                        <SelectItem key={t.slug} value={t.slug}>
                          {t.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mb-1">
                  Assunto
                </p>
                <Input
                  value={emailDialog.subject}
                  onChange={(e) => setEmailDialog({ ...emailDialog, subject: e.target.value })}
                />
              </div>
              <div>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mb-1">
                  Mensagem
                </p>
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
                  const res = await sendAdminEmail({
                    data: { ...emailDialog, template_slug: emailTemplateSlug },
                  });
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
              disabled={
                sendingEmail || !emailDialog?.subject.trim() || !emailDialog?.message.trim()
              }
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
          {bulkDialog &&
            (() => {
              const recipients = prestadores.filter(
                (p) => selectedIds.has(p.user_id) && p.email && p.email !== "—",
              );
              return (
                <div className="space-y-3">
                  <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="font-semibold mb-1">{recipients.length} destinatário(s)</p>
                    <p className="text-muted-foreground">
                      Um e-mail individual será enviado para cada um (não aparece como lista).
                      Throttle ~1,5/s.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1">Template</p>
                    <Select
                      value={bulkDialog.template_slug || "admin_contato"}
                      onValueChange={(v) => {
                        const tpl = templates.find((t) => t.slug === v);
                        setBulkDialog({
                          ...bulkDialog,
                          template_slug: v,
                          subject: tpl?.assunto || bulkDialog.subject,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin_contato">Padrão (admin_contato)</SelectItem>
                        {templates
                          .filter((t) => t.slug !== "admin_contato")
                          .map((t) => (
                            <SelectItem key={t.slug} value={t.slug}>
                              {t.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
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
                              setBulkDialog({
                                ...bulkDialog,
                                message: (bulkDialog.message || "") + " " + v,
                              })
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
                      template_slug: bulkDialog.template_slug,
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
              {sendingBulk ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Enviar para ${selectedIds.size}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {whatsDialog?.open && (
        <WhatsappContatoDialog
          open={whatsDialog.open}
          onOpenChange={(v) => setWhatsDialog(v ? whatsDialog : null)}
          destinatarioUserId={whatsDialog.userId}
          destinatarioEmail={whatsDialog.email}
          telefone={whatsDialog.telefone}
          nome={whatsDialog.nome}
          mensagemSugerida={whatsDialog.mensagem}
          onRegistered={() => setContatoRefresh((n) => n + 1)}
        />
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" /> Excluir cadastro do prestador
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3 text-sm">
              <p>
                Esta ação remove permanentemente <strong>{deleteTarget.nome}</strong> (
                {deleteTarget.email}) da plataforma — login, perfil profissional, documentos e
                vínculos. Não é possível desfazer.
              </p>
              <p className="text-muted-foreground">
                Use quando o prestador desistiu, não vai seguir conosco ou solicitou remoção. Para
                apenas pausar, prefira <em>Rejeitar</em>.
              </p>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground mb-1">
                  Digite <span className="text-red-700">EXCLUIR</span> para confirmar
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="EXCLUIR"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirmText("");
              }}
              disabled={deletingAccount}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExcluirCadastro}
              disabled={deletingAccount || deleteConfirmText.trim().toUpperCase() !== "EXCLUIR"}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {deletingAccount ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Excluir permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
