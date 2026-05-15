import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

export function AdminHeader() {
  const { unreadCount } = useNotifications();
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
      <div className="hidden md:block text-sm text-slate-500">
        Painel administrativo ·{" "}
        {new Date().toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </div>
      <div className="flex items-center gap-4">
        <Link
          to="/cliente"
          search={{ tab: "inicio" } as any}
          className="text-xs font-bold text-slate-500 hover:text-brand"
        >
          Ver app como cliente
        </Link>
        <Link
          to="/admin"
          search={{ tab: "notificacoes" } as any}
          className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-brand text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
