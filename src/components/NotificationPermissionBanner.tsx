import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "notif-prompt-dismissed";

export function NotificationPermissionBanner() {
  const { requestBrowserPermission, browserPermission } = useNotifications();
  const [show, setShow] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (browserPermission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setShow(true);
  }, [browserPermission]);

  if (!show) return null;

  const handleEnable = async () => {
    setAsking(true);
    const result = await requestBrowserPermission();
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
        <h4 className="font-bold text-sm text-slate-900">Receba avisos de novos chamados</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ative as notificações do navegador para ser avisado em tempo real quando um cliente solicitar um orçamento.
        </p>
        <div className="flex gap-2 mt-3">
          <Button onClick={handleEnable} disabled={asking} size="sm" className="rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs">
            {asking ? "Solicitando..." : "Ativar notificações"}
          </Button>
          <Button onClick={handleDismiss} variant="ghost" size="sm" className="rounded-full text-xs text-muted-foreground">
            Agora não
          </Button>
        </div>
      </div>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Fechar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
