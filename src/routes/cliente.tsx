import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Feature modules
import { Tab, ALL_SIDEBAR_ITEMS } from "@/features/cliente/constants";
import { ClienteSidebar } from "@/features/cliente/ClienteSidebar";
import { ClienteHeader } from "@/features/cliente/ClienteHeader";
import { DashboardTab } from "@/features/cliente/DashboardTab";
import { PedidosTab } from "@/features/cliente/PedidosTab";
import { ServicosTab } from "@/features/cliente/ServicosTab";
import { PagamentosTab } from "@/features/cliente/PagamentosTab";
import { NotificacoesTab } from "@/features/cliente/NotificacoesTab";
import { DadosTab } from "@/features/cliente/DadosTab";
import { SegurancaTab } from "@/features/cliente/SegurancaTab";
import { FavoritosTab } from "@/features/cliente/FavoritosTab";
import { SuporteTab } from "@/features/cliente/SuporteTab";
export const Route = createFileRoute("/cliente")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as Tab) || "inicio",
      id: search.id ? String(search.id) : undefined,
      pedidoId: search.pedidoId ? String(search.pedidoId) : undefined,
      chat: search.chat ? String(search.chat) : undefined,
      details: search.details === "true" || search.details === true ? true : undefined,
    } as any;
  },
  component: ClienteArea,
});

function ClienteArea() {
  const { tab: activeTab } = Route.useSearch();
  const { logout, userData, isProfissional, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const setActiveTab = (newTab: Tab) => {
    navigate({
      to: "/cliente",
      search: (prev: any) => ({
        ...prev,
        tab: newTab,
        id: undefined,
        pedidoId: undefined,
        chat: undefined,
        details: false,
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
    if (!user) return;

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
      .subscribe();

    return () => {
      console.log("[ClienteArea] Unsubscribing from realtime");
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row">
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
        {activeTab === "dados" && <DadosTab />}
        {activeTab === "seguranca" && <SegurancaTab />}
        {activeTab === "favoritos" && <FavoritosTab />}
        {activeTab === "suporte" && <SuporteTab />}
      </main>
    </div>
  );
}
