import React from "react";
import { LogOut } from "lucide-react";
import { SidebarItem, Tab } from "./constants";

interface ClienteSidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  sidebarItems: SidebarItem[];
  handleLogout: () => void;
  isProfissional: boolean;
  isAdmin: boolean;
}

export function ClienteSidebar({
  activeTab,
  setActiveTab,
  sidebarItems,
  handleLogout,
  isProfissional,
  isAdmin,
}: ClienteSidebarProps) {
  return (
    <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-border shrink-0 z-20">
      <div className="p-8 hidden md:block">
        <span className="text-xs font-bold uppercase tracking-widest text-brand">
          {isProfissional || isAdmin ? "Sua Conta" : "Área do Cliente"}
        </span>
      </div>

      <nav className="p-4 space-y-1">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === item.id
                ? "bg-brand text-brand-foreground shadow-brand-soft"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
        <button
          onClick={handleLogout}
          className="w-full md:hidden flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </nav>

      <div className="mt-auto p-4 border-t border-border hidden md:block">
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
