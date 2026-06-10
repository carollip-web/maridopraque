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

  return (
    <aside className={asideClass}>
      <div className={headerClass}>
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
