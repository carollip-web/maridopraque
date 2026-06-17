import React, { useEffect } from "react";
import { LogOut } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidebarItem, Tab } from "./constants";

interface ClienteSidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  sidebarItems: SidebarItem[];
  handleLogout: () => void;
  isProfissional: boolean;
  isAdmin: boolean;
  inDrawer?: boolean;
}

export function ClienteSidebar({
  activeTab,
  setActiveTab,
  sidebarItems,
  handleLogout,
  isProfissional,
  isAdmin,
  inDrawer = false,
}: ClienteSidebarProps) {
  const asideClass = inDrawer
    ? "flex flex-col w-full bg-white shrink-0 z-20 h-full"
    : "hidden md:flex md:flex-col w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-border shrink-0 z-20";
  const headerClass = inDrawer ? "p-5" : "p-8 hidden md:block";
  const footerClass = inDrawer
    ? "mt-auto p-4 border-t border-border"
    : "mt-auto p-4 border-t border-border hidden md:block";

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: badges } = useQuery({
    queryKey: ["cliente", "badges", user?.id],
    queryFn: async () => {
      if (!user) return { mensagens: 0, notificacoes: 0, suporte: 0 };
      const [msg, notif, sup] = await Promise.all([
        supabase.from("mensagens").select("id", { count: "exact", head: true }).eq("destinatario_id", user.id).eq("lida", false),
        supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("lida", false),
        supabase.from("suporte_tickets").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "em_andamento")
      ]);
      return {
        mensagens: msg.count || 0,
        notificacoes: notif.count || 0,
        suporte: sup.count || 0,
      };
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("cliente-sidebar-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens", filter: `destinatario_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["cliente", "badges", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["cliente", "badges", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "suporte_tickets", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["cliente", "badges", user.id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return (
    <aside className={asideClass}>
      <div className={headerClass}>
        <span className="text-xs font-bold uppercase tracking-widest text-brand">
          {isProfissional || isAdmin ? "Sua Conta" : "Área do Cliente"}
        </span>
      </div>

      <nav className="p-4 space-y-1">
        {sidebarItems.map((item) => {
          let badgeCount = 0;
          if (item.id === "mensagens") badgeCount = badges?.mensagens || 0;
          if (item.id === "notificacoes") badgeCount = badges?.notificacoes || 0;
          if (item.id === "suporte") badgeCount = badges?.suporte || 0;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? "bg-brand text-brand-foreground shadow-brand-soft"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
              {badgeCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className={footerClass}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </div>
    </aside>
  );
}
