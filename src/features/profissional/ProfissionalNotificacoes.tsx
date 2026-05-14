import React from "react";
import { Bell } from "lucide-react";

interface ProfissionalNotificacoesProps {
  notifications: any[];
  unreadNotifications: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  onNavigateToPedido: (n: any) => void;
}

export function ProfissionalNotificacoes({
  notifications,
  unreadNotifications,
  markAsRead,
  markAllAsRead,
  onNavigateToPedido,
}: ProfissionalNotificacoesProps) {
  if (notifications.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in duration-700">
        <h2 className="text-2xl font-bold tracking-tight">Notificações</h2>
        <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300">
          <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">Nenhuma notificação por enquanto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notificações</h2>
          <p className="text-sm text-muted-foreground">Atualizações sobre seus pedidos e serviços.</p>
        </div>
        {unreadNotifications > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs font-bold text-brand hover:underline uppercase"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>
      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => onNavigateToPedido(n)}
            className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm ${
              n.read
                ? "bg-white border-border opacity-60 hover:opacity-100"
                : "bg-brand/5 border-brand/20 shadow-sm"
            }`}
          >
            <div
              className={`mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                n.read ? "bg-slate-100" : "bg-brand/15"
              }`}
            >
              <Bell className={`h-4 w-4 ${n.read ? "text-slate-400" : "text-brand"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-bold ${n.read ? "text-foreground" : "text-brand"}`}>
                  {n.title}
                </p>
                {!n.read && <div className="h-2 w-2 rounded-full bg-brand mt-1.5 shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.desc}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  {n.time}
                </p>
                {(n.pedidoId || n.link) && (
                  <span className="text-[10px] font-bold text-brand uppercase tracking-wider flex items-center gap-1">
                    Ver pedido →
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
