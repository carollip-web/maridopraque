import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Notification = {
  id: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  pedidoId?: string;
  link?: string;
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

function showBrowserNotification(title: string, body: string, link?: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (window.Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    const n = new window.Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: link ?? title,
    });
    if (link) {
      n.onclick = () => {
        window.focus();
        window.location.href = link;
        n.close();
      };
    }
  } catch {
    // ignore
  }
}

function normalizeNotificationLink(link?: string | null, orcamentoId?: string | null, title?: string | null) {
  const isMessage = (title ?? "").toLowerCase().includes("mensagem");
  if (orcamentoId && link?.startsWith("/profissional")) {
    // "aprovado" and "pago" orders live in the "servicos" tab; everything else in "orcamentos"
    const titleLower = (title ?? "").toLowerCase();
    const isServicos = titleLower.includes("aprovado") || titleLower.includes("pago") || titleLower.includes("conclu");
    const profTab = isServicos ? "servicos" : "orcamentos";
    return `/profissional?tab=${profTab}&orcamentoId=${orcamentoId}${isMessage ? "&chat=1" : ""}`;
  }
  if (orcamentoId && link?.startsWith("/cliente")) {
    return `/cliente?tab=pedidos&pedidoId=${orcamentoId}${isMessage ? "&chat=1" : ""}`;
  }
  return link ?? undefined;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    let userId: string | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchAll = async () => {
      const { data } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (data ?? []).map((n) => {
        const pedidoId = n.orcamento_id ?? undefined;
        return {
          id: n.id,
          title: n.titulo,
          desc: n.mensagem,
          time: timeAgo(n.created_at),
          read: n.lida,
          pedidoId,
          link: normalizeNotificationLink(n.link, pedidoId, n.titulo),
        };
      });

      // Detect new unread items (skip on first load) and trigger native notification
      if (!firstLoad.current) {
        for (const n of list) {
          if (!knownIds.current.has(n.id) && !n.read) {
            showBrowserNotification(n.title, n.desc, n.link);
          }
        }
      }
      knownIds.current = new Set(list.map((n) => n.id));
      firstLoad.current = false;
      setNotifications(list);
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

  const requestBrowserPermission = async (): Promise<NotificationPermission> => {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    if (window.Notification.permission === "granted" || window.Notification.permission === "denied") {
      return window.Notification.permission;
    }
    return await window.Notification.requestPermission();
  };

  const browserPermission: NotificationPermission =
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "denied";

  return {
    notifications,
    markAsRead,
    markAllAsRead,
    unreadCount: notifications.filter((n) => !n.read).length,
    requestBrowserPermission,
    browserPermission,
  };
}
