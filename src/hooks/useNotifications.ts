import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Notification = {
  id: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  pedidoId?: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `Há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Há ${h}h`;
  return `Há ${Math.floor(h / 24)}d`;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    let userId: string | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchAll = async () => {
      const { data } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications(
        (data ?? []).map((n) => ({
          id: n.id,
          title: n.titulo,
          desc: n.mensagem,
          time: timeAgo(n.created_at),
          read: n.lida,
          pedidoId: n.orcamento_id ?? undefined,
        }))
      );
    };

    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id;
      if (!userId) return;
      fetchAll();
      channel = supabase
        .channel("notif-" + userId)
        .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${userId}` }, () => fetchAll())
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = async (id: string | number) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", String(id));
    setNotifications((prev) => prev.map((n) => (n.id === String(id) ? { ...n, read: true } : n)));
  };

  const markAllAsRead = async () => {
    await supabase.from("notificacoes").update({ lida: true }).eq("lida", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return {
    notifications,
    markAsRead,
    markAllAsRead,
    unreadCount: notifications.filter((n) => !n.read).length,
  };
}
