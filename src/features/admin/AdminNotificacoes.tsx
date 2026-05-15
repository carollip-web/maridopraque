import React, { useState } from "react";
import { Bell, ShieldAlert } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { NotificationDetailModal } from "@/components/NotificationDetailModal";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function AdminNotificacoes() {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const navigate = useNavigate();

  const getNotificationTarget = (n: any) => {
    const orcamentoId =
      n.orcamento_id ||
      n.pedido_id ||
      n.metadata?.orcamento_id ||
      n.metadata?.orcamentoId ||
      n.metadata?.pedido_id ||
      n.metadata?.pedidoId ||
      n.data?.orcamento_id ||
      n.data?.orcamentoId ||
      n.data?.pedido_id ||
      n.data?.pedidoId ||
      n.pedidoId;

    return { orcamentoId };
  };

  const handleGoToTarget = (n: any) => {
    const { orcamentoId } = getNotificationTarget(n);
    if (orcamentoId) {
      navigate({
        to: "/admin",
        search: (prev: any) => ({
          ...prev,
          tab: "pedidos",
          q: orcamentoId,
        }),
      });
      setSelectedNotification(null);
    } else {
      toast.error("Não foi possível localizar o pedido desta notificação.");
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <h2 className="text-2xl font-bold tracking-tight">Notificações Administrativas</h2>
        <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300">
          <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">Nenhum alerta pendente no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-brand" /> Notificações do Sistema
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Alertas críticos e atualizações de auditoria.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-brand font-bold text-xs"
            onClick={markAllAsRead}
          >
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => {
              markAsRead(n.id);
              setSelectedNotification(n);
            }}
            className={`p-6 flex gap-5 transition-all cursor-pointer group hover:bg-slate-50 ${n.read ? "bg-white" : "bg-brand/5"}`}
          >
            <div className="mt-1.5 shrink-0">
              <div
                className={`h-2.5 w-2.5 rounded-full transition-colors ${n.read ? "bg-slate-200" : "bg-brand"}`}
              />
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <p
                  className={`text-base font-bold transition-colors ${n.read ? "text-slate-700" : "text-brand group-hover:text-brand-dark"}`}
                >
                  {n.title}
                </p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  {n.time}
                </p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed md:max-w-3xl group-hover:text-slate-600 transition-colors">
                {n.desc}
              </p>

              <div className="flex items-center justify-between mt-4">
                {!n.read && (
                  <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                    Clique para detalhes →
                  </span>
                )}
                {getNotificationTarget(n).orcamentoId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGoToTarget(n);
                    }}
                    className="text-xs font-bold text-brand h-7 px-2"
                  >
                    Ver no admin →
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
        onGoToTarget={handleGoToTarget}
      />
    </div>
  );
}
