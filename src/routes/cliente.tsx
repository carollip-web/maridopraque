import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Feature modules
import { Tab, ALL_SIDEBAR_ITEMS } from "@/features/cliente/constants";
import { ClienteSidebar } from "@/features/cliente/ClienteSidebar";
import { ClienteHeader } from "@/features/cliente/ClienteHeader";
import { MobilePanelBar } from "@/components/MobilePanelBar";
import { DashboardTab } from "@/features/cliente/DashboardTab";
import { PedidosTab } from "@/features/cliente/PedidosTab";
import { ServicosTab } from "@/features/cliente/ServicosTab";
import { PagamentosTab } from "@/features/cliente/PagamentosTab";
import { NotificacoesTab } from "@/features/cliente/NotificacoesTab";
import { MensagensTab } from "@/features/cliente/MensagensTab";
import { DadosTab } from "@/features/cliente/DadosTab";
import { SegurancaTab } from "@/features/cliente/SegurancaTab";
import { FavoritosTab } from "@/features/cliente/FavoritosTab";
import { SuporteTab } from "@/features/cliente/SuporteTab";

const TAB_VALUES = [
  "inicio",
  "pedidos",
  "servicos",
  "pagamentos",
  "dados",
  "seguranca",
  "favoritos",
  "suporte",
  "mensagens",
  "notificacoes",
] as const satisfies readonly Tab[];

const clienteSearchSchema = z.object({
  tab: z.enum(TAB_VALUES).optional().catch("inicio").default("inicio"),
  id: z.string().optional(),
  pedidoId: z.string().optional(),
  orcamentoId: z.string().optional(),
  chat: z.string().optional(),
  details: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === true || v === "true" ? true : undefined)),
  payment: z.enum(["success", "failure", "pending"]).optional().catch(undefined),
});

type ClienteSearch = z.infer<typeof clienteSearchSchema>;

export const Route = createFileRoute("/cliente")({
  validateSearch: clienteSearchSchema,
  component: ClienteArea,
});

function ClienteArea() {
  const { tab: activeTab, payment } = Route.useSearch();
  const { logout, userData, isProfissional, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Visitante que acabou de criar conta + pedido: abrir o pedido automaticamente
  useEffect(() => {
    if (!user) return;
    let pendente: string | null = null;
    try {
      pendente = window.sessionStorage.getItem("abrir_pedido_apos_login");
    } catch {}
    if (pendente) {
      try {
        window.sessionStorage.removeItem("abrir_pedido_apos_login");
      } catch {}
      navigate({
        to: "/cliente",
        search: { tab: "pedidos", pedidoId: pendente } satisfies ClienteSearch,
        replace: true,
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!payment) return;
    if (payment === "success") {
      toast.success("Pagamento aprovado! Seu pedido foi confirmado.");
    } else if (payment === "failure") {
      toast.error("O pagamento não foi concluído. Tente novamente.");
    } else if (payment === "pending") {
      toast.info("Pagamento em análise. Você será notificado quando for confirmado.");
    }
    // Limpa o parâmetro da URL sem recarregar a página
    navigate({
      to: "/cliente",
      search: (prev: ClienteSearch) => {
        const { payment: _payment, ...rest } = prev;
        return rest;
      },
      replace: true,
    });
  }, [payment]);

  const setActiveTab = (newTab: Tab) => {
    navigate({
      to: "/cliente",
      search: (prev: ClienteSearch) => ({
        ...prev,
        tab: newTab,
        id: undefined,
        pedidoId: undefined,
        chat: undefined,
        orcamentoId: undefined,
        details: undefined,
      }),
    });
  };

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  const sidebarItems = ALL_SIDEBAR_ITEMS.filter((item) => {
    if (
      (isProfissional || isAdmin) &&
      ["inicio", "pedidos", "servicos", "pagamentos"].includes(item.id)
    ) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!user?.id) return;

    console.log("[ClienteArea] Subscribing to realtime for user:", user.id);
    const channel = supabase
      .channel(`cliente-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orcamentos",
          filter: `cliente_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Realtime update: orcamentos changed", payload);
          queryClient.invalidateQueries({ queryKey: ["cliente"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "propostas",
        },
        (payload) => {
          console.log("Realtime update: propostas changed", payload);
          queryClient.invalidateQueries({ queryKey: ["cliente"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Tables<"notificacoes">;
          const titulo = String(n?.titulo || "Notificação");
          const mensagem = String(n?.mensagem || "");
          // Destaca cancelamento/multa/reembolso/disputa
          const lower = (titulo + " " + mensagem).toLowerCase();
          if (lower.includes("reembolso") || lower.includes("cancel") || lower.includes("multa") || lower.includes("disputa")) {
            toast.warning(titulo, { description: mensagem, duration: 8000 });
          } else {
            toast(titulo, { description: mensagem });
          }
          queryClient.invalidateQueries({ queryKey: ["cliente", "notificacoes"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pagamento_splits",
          filter: `cliente_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["cliente"] });
        },
      )
      .subscribe();

    return () => {
      console.log("[ClienteArea] Unsubscribing from realtime");
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const currentLabel =
    sidebarItems.find((i) => i.id === activeTab)?.label || "Minha Conta";

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row">
      <MobilePanelBar
        title={currentLabel}
        subtitle={isProfissional || isAdmin ? "Sua conta" : "Área do cliente"}
      >
        <ClienteSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sidebarItems={sidebarItems}
          handleLogout={handleLogout}
          isProfissional={isProfissional}
          isAdmin={isAdmin}
          inDrawer
        />
      </MobilePanelBar>

      <ClienteSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarItems={sidebarItems}
        handleLogout={handleLogout}
        isProfissional={isProfissional}
        isAdmin={isAdmin}
      />

      <main className="flex-1 p-4 md:p-10 max-w-6xl mx-auto w-full relative">
        <ClienteHeader
          activeTab={activeTab}
          sidebarItems={sidebarItems}
          userName={userData?.name || "Usuário"}
        />

        {activeTab === "inicio" && <DashboardTab setActiveTab={setActiveTab} />}
        {activeTab === "pedidos" && <PedidosTab setActiveTab={setActiveTab} />}
        {activeTab === "servicos" && <ServicosTab />}
        {activeTab === "pagamentos" && <PagamentosTab />}
        {activeTab === "notificacoes" && <NotificacoesTab setActiveTab={setActiveTab} />}
        {activeTab === "mensagens" && <MensagensTab />}
        {activeTab === "dados" && <DadosTab />}
        {activeTab === "seguranca" && <SegurancaTab />}
        {activeTab === "favoritos" && <FavoritosTab />}
        {activeTab === "suporte" && <SuporteTab />}
      </main>
    </div>
  );
}
