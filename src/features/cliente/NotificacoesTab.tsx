import React, { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, Bell, MessageCircle, Phone } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Tab } from "./constants";

interface NotificacoesTabProps {
  setActiveTab: (tab: Tab) => void;
}

export function NotificacoesTab({ setActiveTab }: NotificacoesTabProps) {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const searchParams = useSearch({ strict: false }) as any;
  const { id, details } = searchParams;
  const navigate = useNavigate();

  const selectedId = id ? String(id) : null;
  const selectedNotification =
    selectedId != null ? notifications.find((n) => n.id === selectedId) : null;
  const showFullDetails = details === true;

  useEffect(() => {
    if (selectedId != null) {
      markAsRead(selectedId);
    }
  }, [selectedId, markAsRead]);

  const openNotification = (notifId: string) => {
    markAsRead(notifId);
    navigate({
      to: "/cliente",
      search: (prev: any) => ({ ...prev, id: String(notifId), details: undefined }),
    });
  };

  const handleBackToList = () => {
    navigate({
      to: "/cliente",
      search: (prev: any) => ({ ...prev, id: undefined, details: undefined }),
    });
  };

  const openFullDetails = () => {
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, details: true }) });
  };

  const closeFullDetails = () => {
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, details: undefined }) });
  };

  if (selectedNotification) {
    if (showFullDetails) {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <button
            onClick={closeFullDetails}
            className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand transition-colors mb-4"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar para a mensagem
          </button>

          <div className="bg-white rounded-[2rem] border border-border p-8 md:p-12 shadow-soft">
            <h3 className="text-2xl font-bold text-slate-800 mb-8">Detalhamento Completo</h3>

            <div className="space-y-10">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Resumo do Serviço
                  </p>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Tipo:</span>
                      <span className="text-sm font-bold">{selectedNotification.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Protocolo:</span>
                      <span className="text-sm font-bold">
                        #2026-0{selectedNotification.id}X-88
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Data Solicitação:</span>
                      <span className="text-sm font-bold">{selectedNotification.time}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Financeiro
                  </p>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Mão de Obra:</span>
                      <span className="text-sm font-bold">R$ 120,00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Taxa de Visita:</span>
                      <span className="text-sm font-bold">R$ 30,00</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between">
                      <span className="text-sm font-bold text-brand">Total Estimado:</span>
                      <span className="text-sm font-bold text-brand">R$ 150,00</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Histórico de Alterações
                </p>
                <div className="space-y-4">
                  {[
                    { date: "Hoje, 14:00", text: "Orçamento aprovado pelo profissional" },
                    { date: "Ontem, 09:30", text: "Profissional Ricardo M. aceitou o chamado" },
                    { date: "Ontem, 08:00", text: "Pedido registrado no sistema" },
                  ].map((h, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="h-2 w-2 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{h.text}</p>
                        <p className="text-[10px] text-muted-foreground">{h.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border">
              <Button
                onClick={() => setActiveTab("pedidos")}
                className="bg-brand text-white rounded-full px-8 font-bold h-12 shadow-lg"
              >
                Acessar Central de Pedidos
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para notificações
        </button>

        <div className="bg-white rounded-[2rem] border border-border p-8 md:p-12 shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <div className="h-14 w-14 rounded-2xl bg-[#fefaf9] flex items-center justify-center">
              <Bell className="h-7 w-7 text-[#b85c45]" />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {selectedNotification.time}
            </p>
          </div>

          <h3 className="text-2xl font-bold text-slate-800 mb-4">{selectedNotification.title}</h3>
          <div className="prose prose-slate max-w-none">
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              {selectedNotification.desc}
            </p>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest text-[10px]">
                Informações Adicionais
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Protocolo
                  </p>
                  <p className="text-sm font-bold">#2026-0{selectedNotification.id}X-88</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Ação Necessária
                  </p>
                  <button
                    onClick={openFullDetails}
                    className="text-sm font-bold text-brand hover:underline block text-left"
                  >
                    Ver detalhes completos
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => {
                if (selectedNotification.pedidoId) {
                  navigate({
                    to: "/cliente",
                    search: () => ({
                      tab: "pedidos" as Tab,
                      pedidoId: selectedNotification.pedidoId,
                      id: undefined,
                      chat: undefined,
                      details: false,
                    }),
                  });
                } else {
                  setActiveTab("pedidos");
                }
              }}
              className="bg-[#1a1513] text-white rounded-full px-8 font-bold h-12 shadow-lg hover:scale-[1.02] transition-transform"
            >
              Ir para o Serviço
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-8 font-bold h-12 border-border"
              onClick={handleBackToList}
            >
              Marcar como resolvido
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
              onClick={() => openNotification(n.id)}
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

                {!n.read && (
                  <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-[#b85c45] mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    Clique para abrir →
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
