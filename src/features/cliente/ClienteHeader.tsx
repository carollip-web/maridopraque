import React from "react";
import { SidebarItem, Tab } from "./constants";

interface ClienteHeaderProps {
  activeTab: Tab;
  sidebarItems: SidebarItem[];
  userName: string;
}

export function ClienteHeader({ activeTab, sidebarItems, userName }: ClienteHeaderProps) {
  const currentLabel = sidebarItems.find((i) => i.id === activeTab)?.label || "Minha Conta";
  const firstName = userName?.split(" ")[0] || "Usuário";

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm pt-4 pb-4 -mx-4 px-4 md:-mx-10 md:px-10 border-b border-border/50">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{currentLabel}</h1>
        <p className="text-muted-foreground mt-1">Bem-vindo(a) de volta, {firstName}!</p>
      </div>
    </header>
  );
}
