import { Wrench, LogOut } from "lucide-react";
import { type AdminSection, type AdminLevel } from "@/hooks/useAuth";
import React from "react";

interface SidebarItem {
  id: AdminSection;
  label: string;
  icon: React.ElementType;
}

interface AdminSidebarProps {
  activeTab: AdminSection;
  setActiveTab: (tab: AdminSection) => void;
  sidebarItems: SidebarItem[];
  profile: any;
  user: any;
  initials: string;
  levelMeta: {
    label: string;
    color: string;
    icon: React.ElementType;
  } | null;
  logout: () => Promise<void>;
  navigate: (params: { to: string }) => void;
  inDrawer?: boolean;
}

export function AdminSidebar({
  activeTab,
  setActiveTab,
  sidebarItems,
  profile,
  user,
  initials,
  levelMeta,
  logout,
  navigate,
  inDrawer = false,
}: AdminSidebarProps) {
  const adminEmail = profile?.email ?? user?.email ?? "";
  const asideClass = inDrawer
    ? "flex w-full bg-[#0F172A] text-white shrink-0 z-30 flex-col h-full"
    : "hidden md:flex w-full md:w-64 bg-[#0F172A] text-white shrink-0 z-30 flex-col";

  return (
    <aside className={asideClass}>
      <div className="p-6 flex items-center gap-3">
        <div className="h-8 w-8 bg-brand rounded-lg flex items-center justify-center">
          <Wrench className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold tracking-tight text-lg">Admin Panel</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === item.id
                ? "bg-brand text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold truncate">{profile?.nome || "Administrador"}</p>
            <p className="text-[10px] text-slate-500 truncate">{adminEmail}</p>
            {levelMeta && (
              <span
                className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${levelMeta.color}`}
              >
                <levelMeta.icon className="h-2.5 w-2.5" />
                {levelMeta.label}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={async () => {
            await logout();
            navigate({ to: "/login" });
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>
    </aside>
  );
}
