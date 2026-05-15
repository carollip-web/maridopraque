import React, { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, Bell, MessageCircle, Phone } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { NotificationDetailModal } from "@/components/NotificationDetailModal";
import { Tab } from "./constants";
import { toast } from "sonner";

interface NotificacoesTabProps {
  setActiveTab: (tab: Tab) => void;
}

export function NotificacoesTab({ setActiveTab }: NotificacoesTabProps) {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const searchParams = useSearch({ strict: false }) as any;
  const navigate = useNavigate();
  
  const [selectedNotification, setSelectedNotification] = React.useState<any | null>(null);

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

    const status =
      n.status ||
      n.metadata?.status ||
      n.data?.status;

    return { orcamentoId, status };
  };

  const handleGoToTarget = (n: any) => {
    const { orcamentoId } = getNotificationTarget(n);
    if (orcamentoId) {
      navigate({
        to: "/cliente",
        search: (prev: any) => ({
          ...prev,
          tab: "pedidos",
          id: orcamentoId,
          details: "1",
        }),
      });
      setSelectedNotification(null);
    } else {
      toast.error("Não foi possível localizar o pedido desta notificação.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Notificações</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-[#b85c45] font-bold text-xs hover:bg-[#b85c45]/10 px-2"
            onClick={markAllAsRead}
          >
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-border shadow-soft divide-y divide-border overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground font-medium">
            Você não tem nenhuma notificação no momento.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                markAsRead(n.id);
                setSelectedNotification(n);
              }}
              className={`p-6 md:p-8 flex gap-5 transition-all cursor-pointer group hover:bg-slate-50 ${n.read ? "bg-white" : "bg-[#fefaf9]"}`}
            >
              <div className="mt-1.5 shrink-0">
                <div
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${n.read ? "bg-slate-200" : "bg-[#b85c45]"}`}
                />
              </div>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <p
                    className={`text-base font-bold transition-colors ${n.read ? "text-slate-700" : "text-[#b85c45] group-hover:text-brand"}`}
                  >
                    {n.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    {n.time}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed md:max-w-2xl group-hover:text-slate-600 transition-colors">
                  {n.desc}
                </p>

                <div className="flex items-center justify-between mt-4">
                  {!n.read && (
                    <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-[#b85c45] opacity-0 group-hover:opacity-100 transition-opacity">
                      Clique para abrir →
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
                      Ver pedido →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
        onGoToTarget={handleGoToTarget}
      />
    </div>
  );
}
