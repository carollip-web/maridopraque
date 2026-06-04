import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState, useMemo } from "react";
import { useAuth, type AdminSection } from "@/hooks/useAuth";
import { AdminSidebar } from "@/features/admin/AdminSidebar";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { ALL_SIDEBAR_ITEMS, ADMIN_LEVEL_LABELS } from "@/features/admin/constants";

// New feature components
import { AdminPedidos } from "@/features/admin/AdminPedidos";
import { AdminProfissionais } from "@/features/admin/AdminProfissionais";
import { AdminClientes } from "@/features/admin/AdminClientes";
import { AdminServicos } from "@/features/admin/AdminServicos";
import { AdminFinanceiro } from "@/features/admin/AdminFinanceiro";
import { AdminConfig } from "@/features/admin/AdminConfig";
import { AdminEquipe } from "@/features/admin/AdminEquipe";
import { AdminNotificacoes } from "@/features/admin/AdminNotificacoes";
import { AdminLeads } from "@/features/admin/AdminLeads";
import { AdminApoioFeminino } from "@/features/admin/AdminApoioFeminino";
import { AdminKPIs } from "@/features/admin/AdminKPIs";
import { AdminDados } from "@/features/admin/AdminDados";
import { AdminMetrics } from "@/components/AdminMetrics";

export const Route = createFileRoute("/admin")({
  component: AdminArea,
  validateSearch: (search: Record<string, unknown>) => {
    return z
      .object({
        tab: z.string().optional(),
        q: z.string().optional(),
        status: z.string().optional(),
        pro_id: z.string().optional(),
        range: z.string().optional(),
        cli_q: z.string().optional(),
        pro_q: z.string().optional(),
        pro_status: z.string().optional(),
      })
      .parse(search);
  },
  head: () => ({ meta: [{ title: "Admin · Marido pra Quê?" }] }),
});

function AdminArea() {
  const {
    isLoggedIn,
    isAdmin,
    loading,
    logout,
    canAccess,
    allowedTabs,
    profile,
    user,
    adminLevel,
  } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminSection>("dashboard");
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/admin" }) as any;

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn || !isAdmin) {
      navigate({ to: "/login" });
      return;
    }

    // Sync active tab with URL
    if (searchParams.tab && searchParams.tab !== activeTab) {
      if (canAccess(searchParams.tab as AdminSection)) {
        setActiveTab(searchParams.tab as AdminSection);
      } else {
        // Redirect to first allowed tab if current is forbidden
        const first = allowedTabs[0];
        if (first) {
          setActiveTab(first);
          navigate({ to: "/admin", search: (old: any) => ({ ...old, tab: first }) });
        }
      }
    } else if (!searchParams.tab) {
      // Default to dashboard or first allowed
      const defaultTab = canAccess("dashboard") ? "dashboard" : allowedTabs[0];
      if (defaultTab) {
        setActiveTab(defaultTab);
        navigate({ to: "/admin", search: (old: any) => ({ ...old, tab: defaultTab }) });
      }
    }
  }, [loading, isLoggedIn, isAdmin, navigate, searchParams.tab, activeTab, canAccess, allowedTabs]);

  const initials = useMemo(() => {
    return (profile?.nome || "A")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [profile]);

  const levelMeta = adminLevel ? ADMIN_LEVEL_LABELS[adminLevel] : null;

  const sidebarItems = ALL_SIDEBAR_ITEMS.filter((item) => canAccess(item.id));

  const handleTabChange = (tab: AdminSection) => {
    setActiveTab(tab);
    navigate({ to: "/admin", search: (old: any) => ({ ...old, tab }) });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans selection:bg-brand/10 selection:text-brand">
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        sidebarItems={sidebarItems}
        profile={profile}
        user={user}
        initials={initials}
        levelMeta={levelMeta as any}
        logout={logout}
        navigate={navigate as any}
      />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AdminHeader />

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto pb-20">
            {activeTab === "dashboard" && <AdminMetrics onTabChange={handleTabChange} />}
            {activeTab === "pedidos" && <AdminPedidos />}
            {activeTab === "profissionais" && <AdminProfissionais />}
            {activeTab === "clientes" && <AdminClientes />}
            {activeTab === "servicos" && <AdminServicos />}
            {activeTab === "financeiro" && <AdminFinanceiro />}
            {activeTab === "config" && <AdminConfig />}
            {activeTab === "notificacoes" && <AdminNotificacoes />}
            {activeTab === "leads" && <AdminLeads />}
            {activeTab === "apoio_feminino" && <AdminApoioFeminino />}
            {activeTab === "kpis" && <AdminKPIs />}
            {activeTab === "dados" && <AdminDados />}
          </div>
        </div>
      </main>
    </div>
  );
}
