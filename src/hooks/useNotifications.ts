import { useState, useEffect } from "react";

export type Notification = {
  id: number;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  pedidoId?: string; // linked pedido/service ID
};

let notifications: Notification[] = [
  { id: 1, title: "Orçamento Aprovado", desc: "O profissional Ricardo M. aprovou seu orçamento para Pintura de Quarto.", time: "Há 2 horas", read: false, pedidoId: "#8830" },
  { id: 2, title: "Lembrete de Serviço", desc: "Seu serviço de Montagem de Guarda-roupa está agendado para amanhã às 10:00.", time: "Há 1 dia", read: false, pedidoId: "#8842" },
  { id: 3, title: "Pagamento Confirmado", desc: "Seu pagamento via Pix foi processado com sucesso.", time: "Há 3 dias", read: true, pedidoId: "#8839" },
];

const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

export const notificationsStore = {
  getSnapshot: () => notifications,
  markAsRead: (id: number) => {
    notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    notifyListeners();
  },
  markAllAsRead: () => {
    notifications = notifications.map(n => ({ ...n, read: true }));
    notifyListeners();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }
};

export function useNotifications() {
  const [data, setData] = useState(notificationsStore.getSnapshot());

  useEffect(() => {
    return notificationsStore.subscribe(() => {
      setData(notificationsStore.getSnapshot());
    });
  }, []);

  return {
    notifications: data,
    markAsRead: notificationsStore.markAsRead,
    markAllAsRead: notificationsStore.markAllAsRead,
    unreadCount: data.filter(n => !n.read).length
  };
}
