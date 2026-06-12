import React from "react";
import {
  LayoutGrid,
  Send,
  Briefcase,
  CalendarClock,
  Wallet,
  MessageSquare,
  MessageCircle,
  Settings,
  Bell,
} from "lucide-react";
import { ProfissionalTab } from "./types";

interface ProfissionalSidebarProps {
  activeTab: ProfissionalTab;
  setActiveTab: (tab: ProfissionalTab) => void;
  counts: {
    oportunidades: number;
    elaboracao: number;
  };
  unreadNotifications: number;
  unreadMensagens?: number;
}

export function ProfissionalSidebar({
  activeTab,
  setActiveTab,
  counts,
  unreadNotifications,
  unreadMensagens = 0,
}: ProfissionalSidebarProps) {
  const menuItems = [
    { id: "pedidos" as const, label: "Visão Geral", icon: LayoutGrid },
    {
      id: "orcamentos" as const,
      label: "Pedidos e Orçamentos",
      icon: Send,
      badge: counts.oportunidades + counts.elaboracao,
    },
    { id: "servicos" as const, label: "Meus Serviços", icon: Briefcase },
    { id: "agenda" as const, label: "Agenda", icon: CalendarClock },
    { id: "financeiro" as const, label: "Financeiro", icon: Wallet },
    { id: "avaliacoes" as const, label: "Avaliações", icon: MessageSquare },
    {
      id: "mensagens" as const,
      label: "Mensagens",
      icon: MessageCircle,
      badge: unreadMensagens,
    },
    { id: "configuracoes" as const, label: "Configurações do Perfil", icon: Settings },
    {
      id: "notificacoes" as const,
      label: "Notificações",
      icon: Bell,
      badge: unreadNotifications,
    },
  ];

  return (
    <nav className="flex flex-col gap-2">
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
            activeTab === item.id
              ? "bg-brand text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
          {item.badge != null && item.badge > 0 && (
            <span
              className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${activeTab === item.id ? "bg-white/20 text-white" : "bg-brand/15 text-brand"}`}
            >
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
