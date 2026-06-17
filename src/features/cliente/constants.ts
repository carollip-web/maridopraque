import {
  LayoutDashboard,
  ClipboardList,
  History,
  CreditCard,
  Bell,
  User,
  HeadphonesIcon,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";
import React from "react";

export type Tab =
  | "inicio"
  | "pedidos"
  | "servicos"
  | "pagamentos"
  | "dados"
  | "seguranca"
  | "suporte"
  | "mensagens"
  | "notificacoes";

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
  { id: "mensagens", label: "Mensagens", icon: MessageCircle },
  { id: "suporte", label: "Central de Ajuda", icon: HeadphonesIcon },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "dados", label: "Meus Dados", icon: User },
  { id: "seguranca", label: "Segurança e Privacidade", icon: ShieldCheck },
];

export const SUPPORT_MAILTO =
  "mailto:contato@maridopraque.com?subject=Dúvida%20sobre%20meu%20pedido";
