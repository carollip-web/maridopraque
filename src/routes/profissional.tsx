import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Loader2 } from "lucide-react";
import { enviarOrcamento } from "@/lib/orcamentos.functions";

// Feature modules
import { ProfissionalTab } from "@/features/profissional/types";
import { TAB_TITLES } from "@/features/profissional/constants";
import { useProfissionalData } from "@/features/profissional/useProfissionalData";
import { useOrcamentoFilters } from "@/features/profissional/useOrcamentoFilters";
import { ProfissionalSidebar } from "@/features/profissional/ProfissionalSidebar";
import { ProfissionalDashboard } from "@/features/profissional/ProfissionalDashboard";
import { ProfissionalOrcamentos } from "@/features/profissional/ProfissionalOrcamentos";
import { ProfissionalServicos } from "@/features/profissional/ProfissionalServicos";
import { ProfissionalNotificacoes } from "@/features/profissional/ProfissionalNotificacoes";
import { ProfissionalMensagens } from "@/features/profissional/ProfissionalMensagens";
import { useMinhasConversas } from "@/hooks/useMinhasConversas";
import { ProfissionalStatusCard } from "@/features/profissional/ProfissionalStatusCard";
import { OrcamentoDetailsSheet, type SheetMode } from "@/features/profissional/OrcamentoDetailsSheet";

// UI Components
import { ProfissionalConfiguracoes } from "@/components/ProfissionalConfiguracoes";
import { OnboardingWizard } from "@/components/OnboardingWizard";

import { ProfissionalFinanceiro } from "@/components/ProfissionalFinanceiro";
import { ProfissionalAvaliacoes } from "@/components/ProfissionalAvaliacoes";
import { ProfissionalAgenda } from "@/components/ProfissionalAgenda";
import { MobilePanelBar } from "@/components/MobilePanelBar";

const profissionalSearchSchema = z.object({
  tab: z
    .enum([
      "pedidos",
      "orcamentos",
      "servicos",
      "agenda",
      "financeiro",
      "avaliacoes",
      "configuracoes",
      "mensagens",
      "notificacoes",
    ])
    .optional()
    .catch("pedidos"),
  orcamentoId: z.string().optional(),
  chat: z.string().optional(),
});

type ProfissionalSearch = z.infer<typeof profissionalSearchSchema>;

const catalogNameKey = (name: string | null | undefined) =>
  `name:${String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()}`;

export const Route = createFileRoute("/profissional")({
  validateSearch: profissionalSearchSchema,
  component: ProfissionalArea,
});

function ProfissionalArea() {
  const { tab = "pedidos", orcamentoId, chat } = Route.useSearch();
  const { user, isProfissional, loading } = useAuth();
  const navigate = useNavigate();
  const enviar = useServerFn(enviarOrcamento);

  const {
    notifications: profNotificationsAll,
    markAsRead: markNotifAsRead,
    markAllAsRead: markAllNotifAsRead,
  } = useNotifications();
  const profNotifications = profNotificationsAll.filter(
    (n) => !n.link || n.link.startsWith("/profissional"),
  );
  const unreadNotifications = profNotifications.filter((n) => !n.read).length;
  const { totalNaoLidas: unreadMensagens } = useMinhasConversas();

  // UI state (sub-abas, sheet)
  const [pedidosSubTab, setPedidosSubTab] = useState<string>("oportunidades");
  const [servicosSubTab, setServicosSubTab] = useState<string>("ativos");
  const [sheetOrcamentoId, setSheetOrcamentoId] = useState<string | null>(null);

  // Estado e ações do profissional (hook)
  const data = useProfissionalData(user);

  // Filtros e contagens (hook)
  const { filterBy, counts } = useOrcamentoFilters({
    orcamentos: data.orcamentos,
    userId: user?.id,
    especialidades: data.especialidades,
    profGeo: data.profGeo,
    clienteGeo: data.clienteGeo,
    catalog: data.catalog,
    minhasPropostas: data.minhasPropostas,
    recusados: data.recusados,
    propostasEnviadasLocal: data.propostasEnviadasLocal,
    profGenero: data.profGenero,
    profApoioFeminino: data.profApoioFeminino,
    profAtivo: data.ativo,
  });

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  // Redireciona para o cadastro se não estiver aprovado
  useEffect(() => {
    if (!user || loading) return;
    (async () => {
      const { data: perfil } = await supabase
        .from("profissional_perfil")
        .select("cadastro_completo, aprovacao_status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (perfil && perfil.aprovacao_status !== "aprovado") {
        navigate({ to: "/profissional-cadastro" });
      }
    })();
  }, [user, loading, navigate]);

  // Deep link: abrir orcamento via querystring
  useEffect(() => {
    if (tab === "mensagens") return;
    if (!orcamentoId || data.loadingList || data.orcamentos.length === 0)
      return;
    const o = data.orcamentos.find((x) => x.id === orcamentoId);
    if (!o) return;

    setSheetOrcamentoId(orcamentoId);

    const isMine = o.profissional_id === user?.id;
    const inServicos =
      isMine &&
      (o.status === "aprovado" ||
        o.status === "pago" ||
        o.status === "concluido" ||
        o.status === "cancelado" ||
        o.status === "recusado");
    const targetTab = inServicos ? "servicos" : "orcamentos";

    if (tab !== targetTab) {
      navigate({
        to: "/profissional",
        search: (prev: ProfissionalSearch) => ({ ...prev, tab: targetTab, orcamentoId, chat }),
      });
      return;
    }

    if (inServicos) {
      setServicosSubTab(
        o.status === "aprovado" || o.status === "pago"
          ? "ativos"
          : "finalizados",
      );
    } else if (
      o.status === "customizado_pendente" &&
      o.profissional_id === null
    ) {
      setPedidosSubTab("oportunidades");
    } else if (
      o.status === "customizado_pendente" &&
      o.profissional_id === user?.id
    ) {
      setPedidosSubTab("elaboracao");
    } else if (o.status === "enviado") {
      setPedidosSubTab("enviados");
    }
  }, [
    orcamentoId,
    chat,
    data.orcamentos,
    data.loadingList,
    tab,
    user?.id,
    navigate,
  ]);

  // Toast e som para novos pedidos
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("toast-novo-pedido")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new as Tables<"notificacoes">;
          if (newNotif.titulo.toLowerCase().includes("novo pedido")) {
            // Tocar som opcionalmente se permitido
            if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
              try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                osc.frequency.value = 880;
                osc.connect(ctx.destination);
                osc.start();
                setTimeout(() => osc.stop(), 150);
              } catch (e) {
                // ignorar
              }
            }
            
            import("sonner").then((m) => {
              m.toast(newNotif.titulo, {
                description: newNotif.mensagem,
                duration: Infinity, // autoClose: false
                action: {
                  label: "Ver pedido",
                  onClick: () => {
                    navigate({
                      to: "/profissional",
                      search: (prev: ProfissionalSearch) => ({
                        ...prev,
                        tab: "orcamentos",
                        orcamentoId: newNotif.orcamento_id ?? undefined,
                      })
                    });
                  }
                }
              });
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (!user) return null;

  if (!isProfissional) {
    return (
      <div className="max-w-md mx-auto py-32 text-center px-4">
        <h1 className="text-2xl font-bold mb-3">Acesso restrito</h1>
        <p className="text-muted-foreground mb-6">
          Esta área é exclusiva para profissionais cadastrados. Fale com o admin
          para obter acesso.
        </p>
        <Link to="/" className="text-brand font-bold underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  // ---- Handlers locais ao componente ----

  const handleProposalSent = (args: {
    orcamentoId: string;
    proposta: Partial<Tables<"propostas">> & Record<string, unknown>;
    orcamento: Partial<Tables<"orcamentos">> & Record<string, unknown>;
  }) => {
    data.handleProposalSent(args, () => setPedidosSubTab("enviados"));
  };

  const handleNavigateToNotifPedido = (n: Notification) => {
    markNotifAsRead(n.id);
    if (n.pedidoId) {
      const titleLower = n.title.toLowerCase();
      const isServicos =
        titleLower.includes("aprovado") ||
        titleLower.includes("pago") ||
        titleLower.includes("conclu");
      navigate({
        to: "/profissional",
        search: (prev: ProfissionalSearch) => ({
          ...prev,
          tab: isServicos ? "servicos" : "orcamentos",
          orcamentoId: n.pedidoId,
        }),
      });
    } else if (n.link) {
      try {
        const url = new URL(n.link, window.location.origin);
        const oid = url.searchParams.get("orcamentoId");
        const rawTab = url.searchParams.get("tab");
        const t = (profissionalSearchSchema.shape.tab.safeParse(rawTab).success
          ? (rawTab as ProfissionalTab)
          : "orcamentos") satisfies ProfissionalTab;
        navigate({
          to: "/profissional",
          search: (prev: ProfissionalSearch) => ({
            ...prev,
            tab: t,
            orcamentoId: oid ?? undefined,
          }),
        });
      } catch {
        navigate({
          to: "/profissional",
          search: (prev: ProfissionalSearch) => ({ ...prev, tab: "orcamentos" }),
        });
      }
    }
  };

  const closeSheet = () => {
    setSheetOrcamentoId(null);
    navigate({
      to: "/profissional",
      search: (prev: ProfissionalSearch) => ({ ...prev, orcamentoId: undefined }),
    });
  };

  // Sheet selecionado + modo
  const sheetOrc = sheetOrcamentoId
    ? (data.orcamentos.find((o) => o.id === sheetOrcamentoId) ?? null)
    : null;

  const sheetMode: SheetMode = sheetOrc
    ? sheetOrc.profissional_id === user?.id
      ? sheetOrc.status === "enviado"
        ? "revisar"
        : sheetOrc.status === "customizado_pendente"
          ? "enviar"
          : "info"
      : "pegar"
    : "pegar";

  const setActiveTab = (newTab: ProfissionalTab) =>
    navigate({
      to: "/profissional",
      search: (prev: ProfissionalSearch) => ({
        ...prev,
        tab: newTab,
        orcamentoId: undefined,
        chat: undefined,
      }),
    });

  return (
    <div className="min-h-screen bg-slate-50">
      <OnboardingWizard />

      <OrcamentoDetailsSheet
        orcamento={sheetOrc}
        onClose={closeSheet}
        cliente={sheetOrc ? data.profiles[sheetOrc.cliente_id] : undefined}
        clienteCidade={
          sheetOrc ? (data.clienteGeo[sheetOrc.cliente_id]?.cidade ?? null) : null
        }
        range={
          sheetOrc
            ? ((sheetOrc.service_id ? data.catalog[sheetOrc.service_id] : undefined) ??
              data.catalog[catalogNameKey(sheetOrc.service_name)])
            : undefined
        }
        materiais={sheetOrc ? (data.orcMats[sheetOrc.id] ?? []) : []}
        mode={sheetMode}
        enviar={enviar}
        onProposalSent={handleProposalSent}
        refresh={data.refresh}
        userId={user?.id ?? ""}
        onRecusar={data.recusarOrcamento}
        propostaMateriais={data.propostasMateriais}
        minhaAgenda={data.minhaAgenda}
        profGenero={data.profGenero}
        profApoioFeminino={data.profApoioFeminino}
        clienteEndereco={sheetOrc ? data.clienteEndereco[sheetOrc.cliente_id] : undefined}
      />

      <MobilePanelBar
        title={TAB_TITLES[tab as ProfissionalTab] || "Painel"}
        subtitle="Painel profissional"
        hideFrom="lg"
      >
        <div className="p-4 space-y-4">
          <ProfissionalStatusCard
            userName={user?.user_metadata?.nome || "Profissional"}
            mediaAvaliacoes={data.mediaAvaliacoes}
            ativo={data.ativo}
            handleToggleAtivo={data.handleToggleAtivo}
          />
          <ProfissionalSidebar
            activeTab={tab as ProfissionalTab}
            setActiveTab={setActiveTab}
            counts={counts}
            unreadNotifications={unreadNotifications}
            unreadMensagens={unreadMensagens}
          />
        </div>
      </MobilePanelBar>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="hidden lg:block lg:w-64 shrink-0 space-y-6">
            <ProfissionalStatusCard
              userName={user?.user_metadata?.nome || "Profissional"}
              mediaAvaliacoes={data.mediaAvaliacoes}
              ativo={data.ativo}
              handleToggleAtivo={data.handleToggleAtivo}
            />
            <ProfissionalSidebar
              activeTab={tab as ProfissionalTab}
              setActiveTab={setActiveTab}
              counts={counts}
              unreadNotifications={unreadNotifications}
              unreadMensagens={unreadMensagens}
            />
          </aside>

          <main className="flex-1 min-w-0">
            {tab === "notificacoes" && (
              <ProfissionalNotificacoes
                notifications={profNotifications}
                unreadNotifications={unreadNotifications}
                markAsRead={markNotifAsRead}
                markAllAsRead={markAllNotifAsRead}
                onNavigateToPedido={handleNavigateToNotifPedido}
              />
            )}
            {tab === "mensagens" && <ProfissionalMensagens />}
            {tab === "configuracoes" && <ProfissionalConfiguracoes />}
            {tab === "financeiro" && <ProfissionalFinanceiro />}
            {tab === "avaliacoes" && <ProfissionalAvaliacoes />}
            {tab === "agenda" && <ProfissionalAgenda />}
            {tab === "servicos" && (
              <ProfissionalServicos
                servicosSubTab={servicosSubTab}
                setServicosSubTab={setServicosSubTab}
                counts={counts}
                filterBy={filterBy}
                profiles={data.profiles}
                catalog={data.catalog}
                orcMats={data.orcMats}
                clienteGeo={data.clienteGeo}
                clienteEndereco={data.clienteEndereco}
                profGeo={data.profGeo}
                userId={user?.id ?? ""}
                enviar={enviar}
                refresh={data.refresh}
                minhasPropostas={data.minhasPropostas}
                propostasMateriais={data.propostasMateriais}
                minhaAgenda={data.minhaAgenda}
                profGenero={data.profGenero}
                profApoioFeminino={data.profApoioFeminino}
              />
            )}
            {tab === "orcamentos" && (
              <ProfissionalOrcamentos
                pedidosSubTab={pedidosSubTab}
                setPedidosSubTab={setPedidosSubTab}
                counts={counts}
                aReceber={data.aReceber}
                loadingList={data.loadingList}
                filterBy={filterBy}
                profiles={data.profiles}
                catalog={data.catalog}
                orcMats={data.orcMats}
                clienteGeo={data.clienteGeo}
                clienteEndereco={data.clienteEndereco}
                profGeo={data.profGeo}
                userId={user?.id ?? ""}
                enviar={enviar}
                refresh={data.refresh}
                recusarOrcamento={data.recusarOrcamento}
                minhasPropostas={data.minhasPropostas}
                propostasMateriais={data.propostasMateriais}
                especialidades={data.especialidades}
                onProposalSent={handleProposalSent}
                minhaAgenda={data.minhaAgenda}
                profGenero={data.profGenero}
                profApoioFeminino={data.profApoioFeminino}
                temAgenda={data.temAgenda}

              />
            )}
            {tab === "pedidos" && (
              <>
                {!data.mpConectado && (
                  <div className="mx-4 mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <p className="font-bold text-amber-800 text-sm">
                        Conecte sua conta Mercado Pago para receber pagamentos
                      </p>
                      <p className="text-amber-700 text-xs mt-0.5">
                        Sem isso, clientes não podem pagar pelos seus serviços.
                      </p>
                    </div>
                    <a
                      href="/profissional?tab=configuracoes"
                      className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition"
                    >
                      Conectar agora
                    </a>
                  </div>
                )}
                <ProfissionalDashboard
                  user={user}
                  counts={counts}
                  metrics={data.metrics}
                  orcamentos={data.orcamentos}
                  loading={data.loadingList}
                  setTab={(t) =>
                    navigate({
                      to: "/profissional",
                      search: (prev: ProfissionalSearch) => ({ ...prev, tab: t }),
                    })
                  }
                  setPedidosSubTab={setPedidosSubTab}
                  setServicosSubTab={setServicosSubTab}
                />

              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
