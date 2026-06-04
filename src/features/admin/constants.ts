import {
  BarChart3,
  ShoppingBag,
  Wrench,
  Users,
  FileText,
  DollarSign,
  Settings,
  UserCog,
  TestTube,
  ShieldCheck,
  Crown,
  Bell,
} from "lucide-react";
import type { AdminSection, AdminLevel } from "@/hooks/useAuth";
export type { AdminSection, AdminLevel };
import React from "react";

export const ADMIN_LEVEL_LABELS: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  super_admin: { label: "Super Admin", color: "text-red-600 bg-red-50", icon: Crown },
  admin: { label: "Admin", color: "text-orange-600 bg-orange-50", icon: ShieldCheck },
  financeiro: {
    label: "Financeiro",
    color: "text-yellow-600 bg-yellow-50",
    icon: DollarSign,
  },
  suporte: { label: "Suporte", color: "text-blue-600 bg-blue-50", icon: Users },
};

export const ALL_SIDEBAR_ITEMS: {
  id: AdminSection;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "pedidos", label: "Gestão de Pedidos", icon: ShoppingBag },
  { id: "profissionais", label: "Profissionais", icon: Wrench },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "servicos", label: "Serviços", icon: FileText },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "config", label: "Configurações", icon: Settings },
  { id: "equipe", label: "Equipe Admin", icon: UserCog },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "dados", label: "Meus Dados", icon: UserCog },
];

export const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  customizado_pendente: { bg: "bg-amber-50", color: "text-amber-700", label: "Pendente" },
  enviado: { bg: "bg-sky-50", color: "text-sky-700", label: "Proposta Enviada" },
  aprovado: { bg: "bg-blue-50", color: "text-blue-700", label: "Aprovado" },
  pago: { bg: "bg-emerald-50", color: "text-emerald-700", label: "Pago" },
  agendado: { bg: "bg-indigo-50", color: "text-indigo-700", label: "Agendado" },
  concluido: { bg: "bg-green-50", color: "text-green-700", label: "Concluído" },
  recusado: { bg: "bg-red-50", color: "text-red-700", label: "Recusado" },
  cancelado: { bg: "bg-slate-100", color: "text-slate-600", label: "Cancelado" },
  fixo_auto: { bg: "bg-violet-50", color: "text-violet-700", label: "Auto-aprovado" },
};
