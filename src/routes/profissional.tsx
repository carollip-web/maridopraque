import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ProfissionalConfiguracoes } from "@/components/ProfissionalConfiguracoes";
import { ProfileCompletenessCard } from "@/components/ProfileCompletenessCard";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { TermoAdesaoDialog } from "@/components/TermoAdesaoDialog";
import { Chat } from "@/components/Chat";
import { NivelBadge } from "@/components/NivelBadge";
import { PanicButton } from "@/components/PanicButton";
import { CheckInOut } from "@/components/CheckInOut";
import { ProfissionalIndicacao } from "@/components/ProfissionalIndicacao";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { SLABadge } from "@/components/SLABadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { enviarOrcamento } from "@/lib/orcamentos.functions";
import { PhotoUploader } from "@/components/PhotoUploader";
import { ProfissionalChart } from "@/components/ProfissionalChart";
import { distanceKm } from "@/lib/geo";
import {
  Wrench,
  Clock,
  CheckCircle2,
  Loader2,
  LogOut,
  Send,
  Pencil,
  XCircle,
  CreditCard,
  DollarSign,
  TrendingUp,
  Star,
  Power,
  User,
  Package,
  Settings,
  Briefcase,
  LayoutGrid,
  MapPin,
  Camera,
  Wallet,
  MessageSquare,
  CalendarClock,
  Bell,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ProfissionalFinanceiro } from "@/components/ProfissionalFinanceiro";
import { ProfissionalAvaliacoes } from "@/components/ProfissionalAvaliacoes";
import { ProfissionalAgenda } from "@/components/ProfissionalAgenda";

export const Route = createFileRoute("/profissional")({
  validateSearch: z.object({
    tab: z.enum(["pedidos", "orcamentos", "servicos", "agenda", "financeiro", "avaliacoes", "configuracoes", "notificacoes"]).optional().catch("pedidos"),
    orcamentoId: z.string().optional(),
    chat: z.string().optional(),
  }),
  component: ProfissionalArea,
});

type Orcamento = {
  id: string;
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
    | "cancelado";
  cliente_id: string;
  profissional_id: string | null;
  observacoes_profissional: string | null;
  created_at: string;
  updated_at: string;
  data_aprovacao: string | null;
  data_pagamento: string | null;
  auto_aprovado: boolean;
  fotos_problema: string[] | null;
  fotos_concluido: string[] | null;
  checkin_em?: string | null;
  checkout_em?: string | null;
};

type ServicoCat = { id: string; preco_min: number | null; preco_max: number | null };
type OrcMat = { orcamento_id: string; nome_snapshot: string; unidade_snapshot: string; quantidade: number; subtotal: number };
type ClienteGeo = { lat: number | null; lng: number | null; cidade: string | null };

type Profile = { id: string; nome: string; whatsapp: string | null; email: string | null };

const STATUS_META: Record<Orcamento["status"], { label: string; className: string }> = {
  customizado_pendente: { label: "Aguardando seu orçamento", className: "bg-amber-100 text-amber-800" },
  enviado: { label: "Enviado ao cliente", className: "bg-sky-100 text-sky-800" },
  fixo_auto: { label: "Preço fixo", className: "bg-slate-100 text-slate-700" },
  aprovado: { label: "Aprovado", className: "bg-emerald-100 text-emerald-800" },
  pago: { label: "Pago — em execução", className: "bg-emerald-600 text-white" },
  concluido: { label: "Concluído", className: "bg-indigo-600 text-white" },
  recusado: { label: "Recusado", className: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelado", className: "bg-slate-200 text-slate-600" },
};

function ProfissionalArea() {
  const { tab = "pedidos", orcamentoId, chat } = Route.useSearch();
  const { user, isProfissional, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [pedidosSubTab, setPedidosSubTab] = useState<string>("oportunidades");
  const [sheetOrcamentoId, setSheetOrcamentoId] = useState<string | null>(null);
  const [servicosSubTab, setServicosSubTab] = useState<string>("ativos");
  const enviar = useServerFn(enviarOrcamento);
  const { notifications: profNotificationsAll, markAsRead: markNotifAsRead, markAllAsRead: markAllNotifAsRead } = useNotifications();
  const profNotifications = profNotificationsAll.filter(n => !n.link || n.link.startsWith("/profissional"));
  const unreadNotifications = profNotifications.filter(n => !n.read).length;

  const [ativo, setAtivo] = useState(false);
  const [mediaAvaliacoes, setMediaAvaliacoes] = useState<string>("—");
  const [ganhosTotais, setGanhosTotais] = useState(0);
  const [aReceber, setAReceber] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [profGeo, setProfGeo] = useState<{ lat: number | null; lng: number | null; raio: number }>({ lat: null, lng: null, raio: 15 });
  const [clienteGeo, setClienteGeo] = useState<Record<string, ClienteGeo>>({});
  const [ganhosMes, setGanhosMes] = useState(0);
  const [taxaAceitacao, setTaxaAceitacao] = useState<string>("—");
  const [slaMedioH, setSlaMedioH] = useState<string>("—");
  const [totalConcluidos, setTotalConcluidos] = useState(0);
  const [recusados, setRecusados] = useState<Set<string>>(new Set());

  const recusarOrcamento = async (orcamentoId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("orcamento_recusas")
      .insert({ orcamento_id: orcamentoId, profissional_id: user.id });
    if (error) { toast.error("Não foi possível recusar agora."); return; }
    setRecusados((s) => new Set(s).add(orcamentoId));
    toast.success("Pedido recusado e removido do seu radar.");
  };

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user]);

  const [catalog, setCatalog] = useState<Record<string, ServicoCat>>({});
  const [orcMats, setOrcMats] = useState<Record<string, OrcMat[]>>({});

  const refresh = async () => {
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar orçamentos", { description: error.message });
      setLoadingList(false);
      return;
    }
    const list = (data ?? []) as Orcamento[];
    setOrcamentos(list);

    const meus = list.filter((o) => o.profissional_id === user?.id);
    const pagos = meus.filter((o) => o.status === "pago" || o.status === "concluido");
    const pendentesPgto = meus.filter((o) => o.status === "aprovado");

    const ganhos = pagos.reduce((acc, o) => acc + Number(o.valor || 0), 0);
    const receber = pendentesPgto.reduce((acc, o) => acc + Number(o.valor || 0), 0);
    const ticket = pagos.length > 0 ? ganhos / pagos.length : 0;

    // Métricas mensais e operacionais
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const ganhosM = pagos
      .filter((o) => new Date(o.data_pagamento ?? o.updated_at) >= inicioMes)
      .reduce((acc, o) => acc + Number(o.valor || 0), 0);
    setGanhosMes(ganhosM);

    // Taxa de aceitação: enviados / (enviados + recusados) — propostas enviadas pelo profissional
    const enviadasOuFinalizadas = meus.filter((o) =>
      ["enviado", "aprovado", "pago", "concluido", "recusado"].includes(o.status),
    );
    const aceitas = enviadasOuFinalizadas.filter((o) => o.status !== "recusado");
    setTaxaAceitacao(
      enviadasOuFinalizadas.length > 0
        ? `${Math.round((aceitas.length / enviadasOuFinalizadas.length) * 100)}%`
        : "—",
    );

    // SLA médio: horas entre criação e envio do orçamento (apenas onde houve envio)
    const enviados = meus.filter((o) =>
      ["enviado", "aprovado", "pago", "concluido"].includes(o.status),
    );
    if (enviados.length > 0) {
      const horas = enviados.reduce((acc, o) => {
        const t = (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 36e5;
        return acc + Math.max(0, t);
      }, 0) / enviados.length;
      setSlaMedioH(horas < 1 ? `${Math.round(horas * 60)} min` : `${horas.toFixed(1)} h`);
    }

    setTotalConcluidos(meus.filter((o) => o.status === "concluido").length);
    setGanhosTotais(ganhos);
    setAReceber(receber);
    setTicketMedio(ticket);

    if (user) {
      const [{ data: perfil }, { data: avs }] = await Promise.all([
        supabase.from("profissional_perfil").select("ativo, especialidades, lat, lng, raio_atendimento_km").eq("user_id", user.id).maybeSingle(),
        supabase.from("avaliacoes").select("nota").eq("profissional_id", user.id),
      ]);
      if (perfil) {
        setAtivo(perfil.ativo);
        setEspecialidades(perfil.especialidades || []);
        setProfGeo({ lat: perfil.lat ?? null, lng: perfil.lng ?? null, raio: perfil.raio_atendimento_km ?? 15 });
      }
      if (avs && avs.length > 0) {
        setMediaAvaliacoes((avs.reduce((acc, a) => acc + a.nota, 0) / avs.length).toFixed(1));
      }
      const { data: recs } = await supabase
        .from("orcamento_recusas")
        .select("orcamento_id")
        .eq("profissional_id", user.id);
      setRecusados(new Set((recs ?? []).map((r: any) => r.orcamento_id)));
    }

    const ids = Array.from(new Set(list.map((o) => o.cliente_id)));
    if (ids.length) {
      const [{ data: profs }, { data: ends }] = await Promise.all([
        supabase.from("profiles").select("id, nome, whatsapp, email").in("id", ids),
        supabase.from("cliente_enderecos").select("user_id, lat, lng, cidade, is_padrao").in("user_id", ids),
      ]);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);
      const gmap: Record<string, ClienteGeo> = {};
      (ends ?? []).forEach((e: any) => {
        const cur = gmap[e.user_id];
        if (!cur || e.is_padrao) gmap[e.user_id] = { lat: e.lat, lng: e.lng, cidade: e.cidade };
      });
      setClienteGeo(gmap);
    }


    const serviceIds = Array.from(new Set(list.map((o) => o.service_id).filter(Boolean) as string[]));
    if (serviceIds.length) {
      const { data: cats } = await supabase
        .from("services_catalog")
        .select("id, preco_min, preco_max")
        .in("id", serviceIds);
      const cmap: Record<string, ServicoCat> = {};
      (cats ?? []).forEach((c: any) => (cmap[c.id] = c));
      setCatalog(cmap);
    }

    const orcIds = list.map((o) => o.id);
    if (orcIds.length) {
      const { data: oms } = await supabase
        .from("orcamento_materiais")
        .select("orcamento_id, nome_snapshot, unidade_snapshot, quantidade, subtotal")
        .in("orcamento_id", orcIds);
      const grouped: Record<string, OrcMat[]> = {};
      (oms ?? []).forEach((m: any) => {
        (grouped[m.orcamento_id] ||= []).push(m as OrcMat);
      });
      setOrcMats(grouped);
    }

    setLoadingList(false);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const channel = supabase
      .channel("prof-orc")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamentos" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Auto-navigate + open sheet when arriving via notification (?orcamentoId=...)
  useEffect(() => {
    if (!orcamentoId || orcamentos.length === 0) return;
    const o = orcamentos.find((x) => x.id === orcamentoId);
    if (!o) return;

    // Open the detail sheet immediately
    setSheetOrcamentoId(orcamentoId);

    // Decide which top tab + sub-tab the orçamento lives in
    const isMine = o.profissional_id === user?.id;
    const inServicos = isMine && (o.status === "aprovado" || o.status === "pago" || o.status === "concluido" || o.status === "cancelado" || o.status === "recusado");
    const targetTab = inServicos ? "servicos" : "orcamentos";

    if (tab !== targetTab) {
      navigate({ to: "/profissional", search: { tab: targetTab as any, orcamentoId, chat } as any });
      return;
    }

    if (inServicos) {
      setServicosSubTab(o.status === "aprovado" || o.status === "pago" ? "ativos" : "finalizados");
    } else if (o.status === "customizado_pendente" && o.profissional_id === null) {
      setPedidosSubTab("oportunidades");
    } else if (o.status === "customizado_pendente" && o.profissional_id === user?.id) {
      setPedidosSubTab("elaboracao");
    } else if (o.status === "enviado") {
      setPedidosSubTab("enviados");
    }
  }, [orcamentoId, chat, orcamentos, tab, user?.id, navigate]);

  const distanciaCliente = (clienteId: string): number | null => {
    if (profGeo.lat == null || profGeo.lng == null) return null;
    const g = clienteGeo[clienteId];
    if (!g || g.lat == null || g.lng == null) return null;
    return distanceKm({ lat: profGeo.lat, lng: profGeo.lng }, { lat: g.lat, lng: g.lng });
  };

  const filterBy = (type: "oportunidades" | "elaboracao" | "enviados" | "ativos" | "finalizados") => {
    return orcamentos.filter((o) => {
      if (type === "oportunidades") {
        if (!(o.status === "customizado_pendente" && o.profissional_id === null && especialidades.includes(o.service_name))) return false;
        if (recusados.has(o.id)) return false;
        // Filtro por raio: só aplica se ambos os lados tiverem geo
        const d = distanciaCliente(o.cliente_id);
        if (d != null && d > profGeo.raio) return false;
        return true;
      }
      if (type === "elaboracao") {
        return o.status === "customizado_pendente" && o.profissional_id === user?.id;
      }
      if (type === "enviados") {
        return o.status === "enviado" && o.profissional_id === user?.id;
      }
      if (type === "ativos") {
        return ["aprovado", "pago"].includes(o.status) && o.profissional_id === user?.id;
      }
      if (type === "finalizados") {
        return ["recusado", "cancelado", "concluido"].includes(o.status) && o.profissional_id === user?.id;
      }
      return false;
    });
  };

  const counts = useMemo(() => {
    return {
      oportunidades: filterBy("oportunidades").length,
      elaboracao: filterBy("elaboracao").length,
      enviados: filterBy("enviados").length,
      ativos: filterBy("ativos").length,
      finalizados: filterBy("finalizados").length,
    };
  }, [orcamentos, especialidades, user?.id, profGeo, clienteGeo]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (!isProfissional) {
    return (
      <div className="max-w-md mx-auto py-32 text-center px-4">
        <h1 className="text-2xl font-bold mb-3">Acesso restrito</h1>
        <p className="text-muted-foreground mb-6">
          Esta área é exclusiva para profissionais cadastrados. Fale com o admin para obter acesso.
        </p>
        <Link to="/" className="text-brand font-bold underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  const handleToggleAtivo = async (checked: boolean) => {
    if (!user) return;
    setAtivo(checked);
    const { error } = await supabase
      .from("profissional_perfil")
      .upsert({ user_id: user.id, ativo: checked, updated_at: new Date().toISOString() });
    if (error) {
      setAtivo(!checked);
      toast.error("Erro ao alterar status", { description: error.message });
    } else {
      toast.success(checked ? "Você está Online e visível" : "Você está Offline");
    }
  };

  const handleGenerateTestOrder = async () => {
    if (!user) return;
    const testServiceName = especialidades.length > 0 ? especialidades[0] : "Serviço Genérico";
    
    toast.loading("Gerando pedido de teste...", { id: "test-order" });
    const { error } = await supabase.from("orcamentos").insert({
      cliente_id: user.id,
      service_name: testServiceName,
      status: "customizado_pendente",
      descricao: "⚠️ Pedido de teste gerado pelo sistema para demonstrar o Radar de Oportunidades.",
    });

    if (error) {
      toast.error("Erro ao gerar teste", { id: "test-order", description: error.message });
    } else {
      toast.success(`Novo pedido de "${testServiceName}" gerado no Radar!`, { id: "test-order" });
    }
  };

  // Find the orcamento for the sheet
  const sheetOrc = sheetOrcamentoId ? orcamentos.find(o => o.id === sheetOrcamentoId) ?? null : null;
  const sheetMode = sheetOrc
    ? sheetOrc.profissional_id === user?.id
      ? (sheetOrc.status === "enviado" ? "revisar" : sheetOrc.status === "customizado_pendente" ? "enviar" : "info")
      : "pegar"
    : "pegar";

  return (
    <div className="min-h-screen bg-slate-50">
      <OnboardingWizard />
      <PanicButton />

      {/* Detail Sheet — opens when arriving via notification */}
      <Sheet open={!!sheetOrc} onOpenChange={(open) => { if (!open) { setSheetOrcamentoId(null); navigate({ to: "/profissional", search: { tab } as any }); }}}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border bg-slate-50">
            <SheetTitle className="text-lg font-bold">{sheetOrc?.service_name ?? "Pedido"}</SheetTitle>
          </SheetHeader>
          <div className="p-6">
            {sheetOrc && (
              <OrcamentoCard
                key={sheetOrc.id + "-sheet"}
                o={sheetOrc}
                cliente={profiles[sheetOrc.cliente_id]}
                clienteCidade={clienteGeo[sheetOrc.cliente_id]?.cidade ?? null}
                distanciaKm={null}
                range={sheetOrc.service_id ? catalog[sheetOrc.service_id] : undefined}
                materiais={orcMats[sheetOrc.id] ?? []}
                mode={sheetMode}
                enviar={enviar}
                refresh={() => { refresh(); setSheetOrcamentoId(null); navigate({ to: "/profissional", search: { tab } as any }); }}
                userId={user?.id ?? ""}
                onRecusar={async (id) => { await recusarOrcamento(id); setSheetOrcamentoId(null); navigate({ to: "/profissional", search: { tab } as any }); }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 shrink-0 space-y-6">
            
            {/* Status Card */}
            <div className="bg-white rounded-3xl border border-border p-6 shadow-sm flex flex-col items-center text-center">
              <div className="h-16 w-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-4">
                <Wrench className="h-7 w-7" />
              </div>
              <div className="mb-6">
                <h3 className="font-bold text-slate-900 leading-tight">{user?.user_metadata?.nome || "Profissional"}</h3>
                <div className="flex items-center justify-center gap-1.5 mt-1.5 text-amber-500 font-medium text-xs">
                  <Star className="h-3.5 w-3.5 fill-amber-500" />
                  <span>{mediaAvaliacoes} Avaliações</span>
                </div>
              </div>
              
              <div className="w-full pt-4 border-t border-border flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${ativo ? "text-emerald-600" : "text-slate-400"}`}>
                  {ativo ? "Online" : "Offline"}
                </span>
                <Switch checked={ativo} onCheckedChange={handleToggleAtivo} className="data-[state=checked]:bg-emerald-500" />
              </div>
            </div>

            <nav className="flex flex-col gap-2">
              <button 
                onClick={() => navigate({ to: "/profissional", search: { tab: "pedidos" }})}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${tab === 'pedidos' ? 'bg-brand text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <LayoutGrid className="h-4 w-4" /> Visão Geral
              </button>

              <button
                onClick={() => navigate({ to: "/profissional", search: { tab: "orcamentos" }})}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${tab === 'orcamentos' ? 'bg-brand text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <Send className="h-4 w-4" /> Pedidos e Orçamentos
                {counts.oportunidades + counts.elaboracao > 0 && (
                  <span className="ml-auto text-[10px] bg-brand/15 text-brand px-2 py-0.5 rounded-full">
                    {counts.oportunidades + counts.elaboracao}
                  </span>
                )}
              </button>

              <button 
                onClick={() => navigate({ to: "/profissional", search: { tab: "servicos" }})}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${tab === 'servicos' ? 'bg-brand text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <Briefcase className="h-4 w-4" /> Meus Serviços
              </button>

              <button
                onClick={() => navigate({ to: "/profissional", search: { tab: "agenda" }})}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${tab === 'agenda' ? 'bg-brand text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <CalendarClock className="h-4 w-4" /> Agenda
              </button>

              <button
                onClick={() => navigate({ to: "/profissional", search: { tab: "financeiro" }})}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${tab === 'financeiro' ? 'bg-brand text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <Wallet className="h-4 w-4" /> Financeiro
              </button>

              <button
                onClick={() => navigate({ to: "/profissional", search: { tab: "avaliacoes" }})}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${tab === 'avaliacoes' ? 'bg-brand text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <MessageSquare className="h-4 w-4" /> Avaliações

              </button>

              <button 
                onClick={() => navigate({ to: "/profissional", search: { tab: "configuracoes" }})}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${tab === 'configuracoes' ? 'bg-brand text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <Settings className="h-4 w-4" /> Configurações do Perfil
              </button>

              <button
                onClick={() => navigate({ to: "/profissional", search: { tab: "notificacoes" }})}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${tab === 'notificacoes' ? 'bg-brand text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <Bell className="h-4 w-4" /> Notificações
                {unreadNotifications > 0 && (
                  <span className="ml-auto text-[10px] bg-brand/15 text-brand px-2 py-0.5 rounded-full">{unreadNotifications}</span>
                )}
              </button>
            </nav>
          </aside>

          <main className="flex-1 min-w-0">
            {tab === "notificacoes" ? (
              <div className="space-y-4 animate-in fade-in duration-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Notificações</h2>
                    <p className="text-sm text-muted-foreground">Atualizações sobre seus pedidos e serviços.</p>
                  </div>
                  {unreadNotifications > 0 && (
                    <button
                      onClick={markAllNotifAsRead}
                      className="text-xs font-bold text-brand hover:underline uppercase"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                {(() => {
                  const profOnly = profNotifications;
                  const handleNotifClick = (n: typeof profOnly[number]) => {
                    markNotifAsRead(n.id);
                    if (n.pedidoId) {
                      const titleLower = n.title.toLowerCase();
                      const isServicos = titleLower.includes("aprovado") || titleLower.includes("pago") || titleLower.includes("conclu");
                      navigate({ to: "/profissional", search: { tab: isServicos ? "servicos" : "orcamentos", orcamentoId: n.pedidoId } as any });
                    } else if (n.link) {
                      // Fallback: try to parse link for params
                      try {
                        const url = new URL(n.link, window.location.origin);
                        const oid = url.searchParams.get("orcamentoId");
                        const t = (url.searchParams.get("tab") as any) || "orcamentos";
                        navigate({ to: "/profissional", search: { tab: t, orcamentoId: oid ?? undefined } as any });
                      } catch {
                        navigate({ to: "/profissional", search: { tab: "orcamentos" } as any });
                      }
                    }
                  };
                  if (profOnly.length === 0) return (
                    <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300">
                      <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium text-sm">Nenhuma notificação por enquanto.</p>
                    </div>
                  );
                  return (
                    <div className="space-y-2">
                      {profOnly.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm ${n.read ? "bg-white border-border opacity-60 hover:opacity-100" : "bg-brand/5 border-brand/20 shadow-sm"}`}
                        >
                          <div className={`mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${n.read ? "bg-slate-100" : "bg-brand/15"}`}>
                            <Bell className={`h-4 w-4 ${n.read ? "text-slate-400" : "text-brand"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-bold ${n.read ? "text-foreground" : "text-brand"}`}>{n.title}</p>
                              {!n.read && <div className="h-2 w-2 rounded-full bg-brand mt-1.5 shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.desc}</p>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{n.time}</p>
                              {(n.pedidoId || n.link) && (
                                <span className="text-[10px] font-bold text-brand uppercase tracking-wider flex items-center gap-1">
                                  Ver pedido →
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : tab === "configuracoes" ? (
              <ProfissionalConfiguracoes />
            ) : tab === "financeiro" ? (
              <ProfissionalFinanceiro />
            ) : tab === "avaliacoes" ? (
              <ProfissionalAvaliacoes />
            ) : tab === "agenda" ? (
              <ProfissionalAgenda />
            ) : tab === "servicos" ? (
              <div className="space-y-8">
                <Tabs value={servicosSubTab} onValueChange={setServicosSubTab} className="w-full animate-in fade-in duration-700">
                  <div className="flex items-center justify-between mb-6">
                     <h2 className="text-xl font-bold text-slate-900 tracking-tight hidden lg:block">Meus Serviços em Andamento</h2>
                     <TabsList className="bg-white border border-slate-200 shadow-sm rounded-full h-auto p-1.5 flex-wrap w-full lg:w-auto">
                       <TabsTrigger value="ativos" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900 data-[state=active]:shadow-none transition-all font-medium">
                         Em andamento <span className="ml-1.5 opacity-60">({counts.ativos})</span>
                       </TabsTrigger>
                       <TabsTrigger value="finalizados" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none transition-all font-medium">
                         Histórico <span className="ml-1.5 opacity-60">({counts.finalizados})</span>
                       </TabsTrigger>
                     </TabsList>
                  </div>

                  <TabsContent value="ativos" className="mt-0 focus-visible:outline-none">
                    <Grid items={filterBy("ativos")} profiles={profiles} catalog={catalog} orcMats={orcMats} clienteGeo={clienteGeo} profGeo={profGeo} userId={user?.id ?? ""} mode="info" enviar={enviar} emptyMsg="Você não possui nenhum serviço em andamento." emptyIcon={CheckCircle2} />
                  </TabsContent>
                  <TabsContent value="finalizados" className="mt-0 focus-visible:outline-none">
                    <Grid items={filterBy("finalizados")} profiles={profiles} catalog={catalog} orcMats={orcMats} clienteGeo={clienteGeo} profGeo={profGeo} userId={user?.id ?? ""} mode="info" enviar={enviar} emptyMsg="Nenhum histórico de orçamentos encerrados." emptyIcon={XCircle} />
                  </TabsContent>
                </Tabs>
              </div>
            ) : tab === "orcamentos" ? (
              <div className="space-y-6">
                <Tabs value={pedidosSubTab} onValueChange={setPedidosSubTab} className="w-full animate-in fade-in duration-700">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-foreground">Pedidos e orçamentos</h2>
                      <p className="text-sm text-muted-foreground">
                        Acompanhe oportunidades, propostas em elaboração e retornos de clientes.
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleGenerateTestOrder} className="rounded-full">
                      Gerar pedido teste
                    </Button>
                  </div>

                  <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Stat icon={Clock} label="Na fila" value={counts.oportunidades} accent="bg-amber-100 text-amber-700" />
                    <Stat icon={Send} label="Para enviar" value={counts.elaboracao} accent="bg-sky-100 text-sky-700" />
                    <Stat icon={TrendingUp} label="Em andamento" value={counts.ativos} accent="bg-emerald-100 text-emerald-700" />
                    <Stat icon={DollarSign} label="A receber" value={aReceber} accent="bg-brand-soft text-brand" />
                  </section>

                  <TabsList className="mt-6 h-auto w-full flex-wrap justify-start rounded-2xl border border-border bg-card p-1.5 shadow-sm lg:w-auto">
                    <TabsTrigger value="oportunidades" className="rounded-xl px-4 py-2 text-sm font-medium">
                      Radar <span className="ml-1.5 opacity-60">({counts.oportunidades})</span>
                    </TabsTrigger>
                    <TabsTrigger value="elaboracao" className="rounded-xl px-4 py-2 text-sm font-medium">
                      Elaborar <span className="ml-1.5 opacity-60">({counts.elaboracao})</span>
                    </TabsTrigger>
                    <TabsTrigger value="enviados" className="rounded-xl px-4 py-2 text-sm font-medium">
                      Enviados <span className="ml-1.5 opacity-60">({counts.enviados})</span>
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-6">
                    {loadingList ? (
                      <div className="grid min-h-60 place-items-center rounded-3xl border border-border bg-card">
                        <Loader2 className="h-6 w-6 animate-spin text-brand" />
                      </div>
                    ) : (
                      <>
                        <TabsContent value="oportunidades" className="mt-0 focus-visible:outline-none">
                          <Grid items={filterBy("oportunidades")} profiles={profiles} catalog={catalog} orcMats={orcMats} clienteGeo={clienteGeo} profGeo={profGeo} userId={user?.id ?? ""} mode="pegar" enviar={enviar} refresh={refresh} onRecusar={recusarOrcamento} emptyMsg="Nenhuma oportunidade disponível para suas especialidades no momento." emptyIcon={Clock} />
                        </TabsContent>
                        <TabsContent value="elaboracao" className="mt-0 focus-visible:outline-none">
                          <Grid items={filterBy("elaboracao")} profiles={profiles} catalog={catalog} orcMats={orcMats} clienteGeo={clienteGeo} profGeo={profGeo} userId={user?.id ?? ""} mode="enviar" enviar={enviar} refresh={refresh} emptyMsg="Você ainda não possui pedidos reservados para elaborar." emptyIcon={Pencil} />
                        </TabsContent>
                        <TabsContent value="enviados" className="mt-0 focus-visible:outline-none">
                          <Grid items={filterBy("enviados")} profiles={profiles} catalog={catalog} orcMats={orcMats} clienteGeo={clienteGeo} profGeo={profGeo} userId={user?.id ?? ""} mode="revisar" enviar={enviar} refresh={refresh} emptyMsg="Nenhuma proposta enviada aguardando resposta." emptyIcon={Send} />
                        </TabsContent>
                      </>
                    )}
                  </div>
                </Tabs>
              </div>
            ) : (
              <div className="space-y-6">
                <NotificationPermissionBanner />

                {/* Hero greeting */}
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-orange-500 to-amber-500 text-white p-6 sm:p-8 shadow-xl">
                  <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
                  <div className="absolute -left-8 -bottom-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
                  <div className="relative flex flex-wrap items-start justify-between gap-6">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/70 font-semibold">
                        {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                      </p>
                      <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">
                        {greetingByHour()}, {(user?.user_metadata as any)?.nome?.split(" ")[0] || "profissional"}!
                      </h2>
                      <p className="mt-2 text-sm text-white/85 max-w-md">
                        {counts.oportunidades > 0
                          ? `Você tem ${counts.oportunidades} oportunidade${counts.oportunidades > 1 ? "s" : ""} esperando no radar.`
                          : counts.elaboracao > 0
                          ? `${counts.elaboracao} orçamento${counts.elaboracao > 1 ? "s" : ""} aguardando você enviar a proposta.`
                          : "Tudo em dia por aqui. Continue acompanhando seus pedidos."}
                      </p>
                    </div>
                    <Button
                      onClick={() => navigate({ to: "/profissional", search: { tab: "orcamentos" }})}
                      className="rounded-full bg-white text-brand hover:bg-white/90 shadow-md font-bold"
                    >
                      Ver pedidos
                    </Button>
                  </div>
                  <div className="relative mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <DashStat label="Ganhos do mês" value={`R$ ${ganhosMes.toFixed(2)}`} />
                    <DashStat label="Aceitação" value={taxaAceitacao} />
                    <DashStat label="SLA médio" value={slaMedioH} />
                    <DashStat label="Concluídos" value={String(totalConcluidos)} />
                  </div>
                </section>

                <ProfileCompletenessCard />

                {/* Pendências acionáveis */}
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <ActionStat
                    icon={Clock}
                    label="Oportunidades no radar"
                    value={counts.oportunidades}
                    accent="from-amber-50 to-amber-100 text-amber-700 ring-amber-200"
                    cta="Ver radar"
                    onClick={() => { setPedidosSubTab("oportunidades"); navigate({ to: "/profissional", search: { tab: "orcamentos" }}); }}
                  />
                  <ActionStat
                    icon={Pencil}
                    label="Para elaborar"
                    value={counts.elaboracao}
                    accent="from-sky-50 to-sky-100 text-sky-700 ring-sky-200"
                    cta="Elaborar agora"
                    onClick={() => { setPedidosSubTab("elaboracao"); navigate({ to: "/profissional", search: { tab: "orcamentos" }}); }}
                  />
                  <ActionStat
                    icon={TrendingUp}
                    label="Em andamento"
                    value={counts.ativos}
                    accent="from-emerald-50 to-emerald-100 text-emerald-700 ring-emerald-200"
                    cta="Ver serviços"
                    onClick={() => { setServicosSubTab("ativos"); navigate({ to: "/profissional", search: { tab: "servicos" }}); }}
                  />
                  <ActionStat
                    icon={DollarSign}
                    label="A receber"
                    value={aReceber}
                    accent="from-orange-50 to-orange-100 text-brand ring-orange-200"
                    cta="Financeiro"
                    onClick={() => navigate({ to: "/profissional", search: { tab: "financeiro" }})}
                  />
                </section>

                {/* Chart + side */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <ProfissionalChart orcamentos={orcamentos as any} userId={user?.id} />
                  </div>
                  <div className="space-y-4">
                    <NivelBadge concluidos={totalConcluidos} notaMedia={Number(mediaAvaliacoes) || 0} />
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Star className="h-4 w-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-foreground">Atalhos rápidos</h3>
                      </div>
                      <div className="grid gap-2">
                        <QuickLink icon={CalendarClock} label="Minha agenda" onClick={() => navigate({ to: "/profissional", search: { tab: "agenda" }})} />
                        <QuickLink icon={Star} label="Avaliações" onClick={() => navigate({ to: "/profissional", search: { tab: "avaliacoes" }})} />
                        <QuickLink icon={Wallet} label="Financeiro" onClick={() => navigate({ to: "/profissional", search: { tab: "financeiro" }})} />
                        <QuickLink icon={Settings} label="Perfil e configurações" onClick={() => navigate({ to: "/profissional", search: { tab: "configuracoes" }})} />
                      </div>
                    </div>
                  </div>
                </div>

                <ProfissionalIndicacao nome={(user?.user_metadata as any)?.nome ?? ""} />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function DashStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
      <p className="text-[11px] uppercase tracking-wider text-white/70">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-full grid place-items-center ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function ActionStat({
  icon: Icon,
  label,
  value,
  accent,
  cta,
  onClick,
}: {
  icon: any;
  label: string;
  value: number;
  accent: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left bg-gradient-to-br ${accent} rounded-2xl p-4 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-full bg-white/70 backdrop-blur grid place-items-center shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-black tracking-tight">{value}</p>
      </div>
      <p className="mt-3 text-xs uppercase tracking-widest font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-xs font-bold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
        {cta} <span aria-hidden>→</span>
      </p>
    </button>
  );
}

function QuickLink({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-brand-soft hover:text-brand transition-colors"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 text-left">{label}</span>
      <span className="text-muted-foreground" aria-hidden>›</span>
    </button>
  );
}

function Grid({
  items,
  profiles,
  catalog,
  orcMats,
  mode,
  enviar,
  refresh,
  emptyMsg,
  emptyIcon: EmptyIcon,
  clienteGeo,
  profGeo,
  userId,
  onRecusar,
}: {
  items: Orcamento[];
  profiles: Record<string, Profile>;
  catalog: Record<string, ServicoCat>;
  orcMats: Record<string, OrcMat[]>;
  mode: "pegar" | "enviar" | "revisar" | "info";
  enviar: any;
  refresh?: () => void;
  emptyMsg: string;
  emptyIcon: any;
  clienteGeo: Record<string, ClienteGeo>;
  profGeo: { lat: number | null; lng: number | null; raio: number };
  userId: string;
  onRecusar?: (id: string) => Promise<void>;
}) {
  if (items.length === 0) {
    return (
      <div className="py-24 px-6 text-center bg-white rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center">
        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
           <EmptyIcon className="h-8 w-8 text-slate-300" />
        </div>
        <p className="text-slate-500 font-medium text-sm max-w-sm">{emptyMsg}</p>
      </div>
    );
  }
  const distFor = (cid: string): number | null => {
    if (profGeo.lat == null || profGeo.lng == null) return null;
    const g = clienteGeo[cid];
    if (!g || g.lat == null || g.lng == null) return null;
    return distanceKm({ lat: profGeo.lat, lng: profGeo.lng }, { lat: g.lat, lng: g.lng });
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((o) => (
        <OrcamentoCard
          key={o.id}
          o={o}
          cliente={profiles[o.cliente_id]}
          clienteCidade={clienteGeo[o.cliente_id]?.cidade ?? null}
          distanciaKm={distFor(o.cliente_id)}
          range={o.service_id ? catalog[o.service_id] : undefined}
          materiais={orcMats[o.id] ?? []}
          mode={mode}
          enviar={enviar}
          refresh={refresh}
          userId={userId}
          onRecusar={onRecusar}
        />
      ))}
    </div>
  );
}

function OrcamentoCard({
  o,
  cliente,
  clienteCidade,
  distanciaKm: distKm,
  range,
  materiais,
  mode,
  enviar,
  refresh,
  userId,
  onRecusar,
}: {
  o: Orcamento;
  cliente: Profile | undefined;
  clienteCidade: string | null;
  distanciaKm: number | null;
  range: ServicoCat | undefined;
  materiais: OrcMat[];
  mode: "pegar" | "enviar" | "revisar" | "info";
  enviar: any;
  refresh?: () => void;
  userId: string;
  onRecusar?: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(mode === "enviar");
  const shouldOpenChat = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("chat") === "1";
  const initialValor = o.valor_servico ?? o.valor ?? null;
  const [valor, setValor] = useState(initialValor != null ? String(initialValor).replace(".", ",") : "");
  const [obs, setObs] = useState(o.observacoes_profissional ?? "");
  const [saving, setSaving] = useState(false);
  const [fotosConcluido, setFotosConcluido] = useState<string[]>(o.fotos_concluido ?? []);
  const [termoOpen, setTermoOpen] = useState(false);

  const meta = STATUS_META[o.status];
  const min = range?.preco_min != null ? Number(range.preco_min) : null;
  const max = range?.preco_max != null ? Number(range.preco_max) : null;

  const handleEnviar = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (isNaN(v) || v < 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (min != null && max != null && (v < min || v > max)) {
      toast.error(`Valor fora do range tabelado (R$ ${min.toFixed(2)} – R$ ${max.toFixed(2)})`);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("orcamentos")
        .update({
          valor_servico: v,
          valor: v,
          observacoes_profissional: obs || null,
          profissional_id: o.profissional_id ?? userId,
          status: "enviado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", o.id);
      if (error) throw error;
      toast.success(mode === "revisar" ? "Orçamento atualizado" : "Orçamento enviado ao cliente");
      if (mode === "revisar") setEditing(false);
      refresh?.();
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRecusar = async () => {
    if (!confirm("Tem certeza que deseja devolver este pedido para a fila? Ele ficará visível para outros profissionais novamente.")) return;
    setSaving(true);
    const { error } = await supabase
      .from("orcamentos")
      .update({ profissional_id: null })
      .eq("id", o.id);
    if (error) {
      toast.error("Erro ao devolver", { description: error.message });
    } else {
      toast.success("Pedido devolvido ao mural de oportunidades.");
      refresh?.();
    }
    setSaving(false);
  };

  const handlePegar = async () => {
    setSaving(true);
    // Verificação dupla no banco
    const { data } = await supabase.from("orcamentos").select("profissional_id").eq("id", o.id).single();
    if (data?.profissional_id) {
      toast.error("Poxa! Outro profissional pegou esse pedido 1 segundo antes de você.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("orcamentos")
      .update({ profissional_id: (await supabase.auth.getUser()).data.user?.id })
      .eq("id", o.id)
      .is("profissional_id", null);

    if (error) {
      toast.error("Erro ao pegar pedido", { description: error.message });
    } else {
      toast.success("Boa! Pedido reservado para você. Agora elabore o orçamento.");
      refresh?.();
    }
    setSaving(false);
  };

  const doAceitar = async () => {
    if (o.valor_servico == null) return;
    setSaving(true);
    const { data: check } = await supabase.from("orcamentos").select("profissional_id").eq("id", o.id).single();
    if (check?.profissional_id) {
      toast.error("Outro profissional pegou esse pedido antes de você.");
      setSaving(false);
      refresh?.();
      return;
    }
    const { error } = await supabase
      .from("orcamentos")
      .update({
        profissional_id: userId,
        valor_servico: o.valor_servico,
        valor: Number(o.valor_servico) + Number(o.taxa_material ?? 0),
        status: "enviado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", o.id)
      .is("profissional_id", null);
    if (error) {
      toast.error("Erro ao aceitar", { description: error.message });
    } else {
      toast.success(`Cotação enviada por R$ ${Number(o.valor_servico).toFixed(2)}!`);
      refresh?.();
    }
    setSaving(false);
  };

  const handleConcluir = async () => {
    if (fotosConcluido.length === 0) {
      if (!confirm("Marcar como concluído sem anexar fotos do serviço pronto? Recomendamos pelo menos 1 foto.")) return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("orcamentos")
      .update({ status: "concluido" as any, fotos_concluido: fotosConcluido })
      .eq("id", o.id);
    if (error) {
      toast.error("Erro ao concluir", { description: error.message });
    } else {
      toast.success("Serviço concluído! O cliente receberá pedido de avaliação.");
      refresh?.();
    }
    setSaving(false);
  };

  const slaHoras = o.status === "customizado_pendente" ? 4 : o.status === "enviado" ? 24 : null;
  
  // Calculate urgency
  let isUrgent = false;
  if (o.status === "customizado_pendente") {
    const hoursSinceCreated = (new Date().getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreated >= 2) isUrgent = true; // Urgent if more than half of the SLA has passed
  }

  const isHighlighted = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("orcamentoId") === o.id;

  return (
    <div id={`orc-${o.id}`} className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden transition-all ${isHighlighted ? 'border-brand ring-2 ring-brand/30 shadow-lg' : isUrgent ? 'border-red-200 shadow-red-50' : 'border-border'}`}>
      {isUrgent && (
        <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold truncate text-slate-900">{o.service_name}</h3>
          <p className={`text-xs mt-0.5 font-medium ${isUrgent ? 'text-red-500' : 'text-muted-foreground'}`}>
            Solicitado em {new Date(o.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap uppercase tracking-wider ${meta.className}`}>
            {meta.label}
          </span>
          {slaHoras && <SLABadge createdAt={o.created_at} prazoHoras={slaHoras} />}
        </div>
      </div>

      <div className="text-sm space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate">{cliente?.nome || "Cliente"}</span>
          {(clienteCidade || distKm != null) && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {clienteCidade}{distKm != null && ` · ${distKm.toFixed(1)} km`}
            </span>
          )}
        </div>
        {o.descricao && (
          <p className="text-muted-foreground bg-slate-50 rounded-xl p-3 text-sm">
            {o.descricao}
          </p>
        )}
        {o.fotos_problema && o.fotos_problema.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {o.fotos_problema.map((u) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                <img src={u} alt="Foto do problema" className="h-16 w-16 rounded-lg object-cover border border-border hover:opacity-90 transition" />
              </a>
            ))}
          </div>
        )}
        {o.valor != null && !editing && (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Total</span>
              <span className="text-lg font-bold">R$ {Number(o.valor).toFixed(2)}</span>
            </div>
            {(Number(o.valor_servico ?? 0) > 0 || Number(o.taxa_material) > 0) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Mão de obra R$ {Number(o.valor_servico ?? 0).toFixed(2)} · Materiais R$ {Number(o.taxa_material).toFixed(2)}
              </p>
            )}
          </div>
        )}
        {materiais.length > 0 && (
          <div className="rounded-xl bg-slate-50 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
              <Package className="h-3 w-3" /> Materiais ({materiais.length})
            </div>
            <ul className="text-xs space-y-0.5">
              {materiais.map((m, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {m.nome_snapshot} <span className="text-muted-foreground">× {Number(m.quantidade)} {m.unidade_snapshot}</span>
                  </span>
                  <span className="tabular-nums font-medium">R$ {Number(m.subtotal).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {o.observacoes_profissional && !editing && (
          <p className="text-sm text-muted-foreground italic">"{o.observacoes_profissional}"</p>
        )}
        {o.status === "pago" && o.data_pagamento && (
          <p className="text-xs text-emerald-700 flex items-center gap-1">
            <CreditCard className="h-3.5 w-3.5" />
            Pago em {new Date(o.data_pagamento).toLocaleDateString("pt-BR")}
          </p>
        )}
        {o.status === "concluido" && o.fotos_concluido && o.fotos_concluido.length > 0 && (
          <div>
            <p className="text-xs uppercase font-bold text-muted-foreground mb-1.5">Serviço concluído</p>
            <div className="flex gap-2 flex-wrap">
              {o.fotos_concluido.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                  <img src={u} alt="Serviço concluído" className="h-16 w-16 rounded-lg object-cover border border-border" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {(o.profissional_id === userId && (o.status === "aprovado" || o.status === "pago")) && (
        <div className="pt-3 border-t border-border">
          <CheckInOut
            orcamentoId={o.id}
            checkinEm={o.checkin_em ?? null}
            checkoutEm={o.checkout_em ?? null}
            onChange={refresh}
          />
        </div>
      )}

      {mode === "info" && o.status === "pago" && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1.5 mb-2">
              <Camera className="h-3.5 w-3.5" /> Fotos do serviço pronto
            </label>
            <PhotoUploader
              userId={userId}
              pathPrefix={`concluido/${o.id}`}
              value={fotosConcluido}
              onChange={setFotosConcluido}
              max={5}
              label="foto do trabalho finalizado"
            />
          </div>
          <Button
            onClick={handleConcluir}
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold h-12 shadow-md"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Marcar como concluído</>}
          </Button>
        </div>
      )}

      {mode === "pegar" ? (
        <div className="space-y-2">
          <TermoAdesaoDialog
            open={termoOpen}
            onOpenChange={setTermoOpen}
            userId={userId}
            onAccepted={() => doAceitar()}
          />
          {o.valor_servico != null && (
            <Button
              onClick={async () => {
                setSaving(true);
                // checa termo aceito
                const { data: perf } = await supabase
                  .from("profissional_perfil")
                  .select("termo_aceito_em")
                  .eq("user_id", userId)
                  .maybeSingle();
                if (!perf?.termo_aceito_em) {
                  setSaving(false);
                  setTermoOpen(true);
                  return;
                }
                await doAceitar();
              }}
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold h-12 shadow-md transition-all hover:scale-[1.02]"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Aceitar por R$ {Number(o.valor_servico).toFixed(2)}</>}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handlePegar}
              disabled={saving}
              variant="outline"
              className="rounded-full font-bold h-11"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Elaborar depois"}
            </Button>
            <Button
              onClick={async () => { if (onRecusar) await onRecusar(o.id); }}
              disabled={saving || !onRecusar}
              variant="ghost"
              className="rounded-full font-bold h-11 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <XCircle className="h-4 w-4 mr-1.5" /> Recusar
            </Button>
          </div>
        </div>
      ) : (mode === "enviar" || (mode === "revisar" && editing)) ? (
        <div className="space-y-3 pt-3 border-t border-border">
              <div>
                <label className="text-xs uppercase font-bold text-muted-foreground">Mão de obra (R$)</label>
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="ex: 180,00"
                  inputMode="decimal"
                  className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                {min != null && max != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Range tabelado: <span className="font-semibold text-foreground">R$ {min.toFixed(2)} a R$ {max.toFixed(2)}</span>
                  </p>
                )}
                {Number(o.taxa_material) > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Materiais: R$ {Number(o.taxa_material).toFixed(2)} (já cotados pelo cliente)
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs uppercase font-bold text-muted-foreground">Observações</label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  maxLength={500}
                  placeholder="Detalhes sobre o serviço, prazo, materiais inclusos…"
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 mt-4">
                {mode === "revisar" && (
                  <Button
                    variant="outline"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="rounded-full flex-1"
                  >
                    Cancelar
                  </Button>
                )}
                {mode === "enviar" && (
                   <Button
                     variant="outline"
                     onClick={handleRecusar}
                     disabled={saving}
                     className="rounded-full flex-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-border"
                   >
                     <XCircle className="h-4 w-4 mr-1.5" /> Devolver p/ Fila
                   </Button>
                )}
                <Button
                  onClick={handleEnviar}
                  disabled={saving}
                  className="flex-[1.5] bg-brand text-brand-foreground rounded-full font-bold"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === "revisar" ? (
                    "Salvar proposta"
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1.5" /> Enviar Cotação
                    </>
                  )}
                </Button>
              </div>
        </div>
      ) : null}

      {mode === "revisar" && !editing && (
        <Button
          variant="outline"
          onClick={() => setEditing(true)}
          className="rounded-full w-full"
        >
          <Pencil className="h-4 w-4 mr-1.5" /> Revisar orçamento
        </Button>
      )}

      {o.profissional_id === userId && (
        <details className="pt-3 border-t border-border" open={shouldOpenChat || undefined}>
          <summary className="cursor-pointer text-xs font-bold text-brand flex items-center gap-1.5 select-none">
            <MessageSquare className="h-3.5 w-3.5" /> Conversar com o cliente
          </summary>
          <div className="mt-3">
            <Chat orcamentoId={o.id} contraparteId={o.cliente_id} contraparteNome={cliente?.nome} />
          </div>
        </details>
      )}
    </div>
  );
}
