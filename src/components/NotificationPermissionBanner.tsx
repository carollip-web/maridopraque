import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { ativarPush } from "@/lib/push";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "notif-prompt-dismissed";

export function NotificationPermissionBanner() {
  const { requestBrowserPermission, browserPermission } = useNotifications();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    // Quem já concedeu antes: garante a subscription de push persistida.
    if (browserPermission === "granted" && user?.id) {
      ativarPush(user.id).catch(() => {});
      return;
    }
    if (browserPermission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setShow(true);
  }, [browserPermission, user?.id]);

  if (!show) return null;

  const handleEnable = async () => {
    setAsking(true);
    const result = await requestBrowserPermission();
    // Se concedeu, assina o push (registra SW + PushManager + salva no banco).
    if (result === "granted" && user?.id) {
      await ativarPush(user.id).catch(() => {});
    }
    setAsking(false);
    if (result !== "default") setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm flex items-start gap-4">
      <div className="h-10 w-10 rounded-full bg-sky-100 text-sky-700 grid place-items-center shrink-0">
        <Bell className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm text-slate-900">Receba avisos em tempo real</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ative as notificações para acompanhar propostas, pagamentos e mensagens — mesmo com o app
          fechado.
        </p>
        <div className="flex gap-2 mt-3">
          <Button
            onClick={handleEnable}
            disabled={asking}
            size="sm"
            className="rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs"
          >
            {asking ? "Solicitando..." : "Ativar notificações"}
          </Button>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="rounded-full text-xs text-muted-foreground"
          >
            Agora não
          </Button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
