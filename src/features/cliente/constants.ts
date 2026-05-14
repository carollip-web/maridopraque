import {
  LayoutDashboard,
  ClipboardList,
  History,
  CreditCard,
  Bell,
  User,
} from "lucide-react";
import React from "react";

export type Tab = "inicio" | "pedidos" | "servicos" | "pagamentos" | "dados" | "notificacoes";

export interface SidebarItem {
  id: Tab;
  label: string;
  icon: React.ElementType;
}

export const ALL_SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "inicio", label: "Meu Painel", icon: LayoutDashboard },
  { id: "pedidos", label: "Pedidos e Orçamentos", icon: ClipboardList },
  { id: "servicos", label: "Histórico de Serviços", icon: History },
  { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "dados", label: "Meus Dados", icon: User },
];

export const WHATSAPP_LINK = "https://wa.me/5521999999999?text=Olá!%20Quero%20falar%20sobre%20meu%20pedido.";
