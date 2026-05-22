import React from "react";
import { X, Bell, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationDetailModalProps {
  notification: any;
  onClose: () => void;
  onGoToTarget: (n: any) => void;
}

export function NotificationDetailModal({
  notification: n,
  onClose,
  onGoToTarget,
}: NotificationDetailModalProps) {
  if (!n) return null;

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

    const status = n.status || n.metadata?.status || n.data?.status;

    const tipo = n.tipo || n.type || n.metadata?.tipo || n.data?.tipo;

    return { orcamentoId, status, tipo };
  };

  const { orcamentoId } = getNotificationTarget(n);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl rounded-[2rem] bg-white shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-slate-100"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 md:p-8">
          <div className="h-14 w-14 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-5">
            <Bell className="h-6 w-6" />
          </div>

          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
            Notificação
          </p>

          <h3 className="text-2xl font-bold">{n.titulo || n.title || "Notificação"}</h3>

          <p className="text-muted-foreground mt-3 leading-relaxed">
            {n.mensagem ||
              n.message ||
              n.desc ||
              n.descricao ||
              n.description ||
              "Sem detalhes adicionais."}
          </p>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Recebida</span>
              <span className="font-bold">
                {n.created_at
                  ? new Date(n.created_at).toLocaleString("pt-BR")
                  : n.time || n.tempo || "Agora"}
              </span>
            </div>

            {orcamentoId && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Pedido</span>
                <span className="font-bold">{String(orcamentoId).slice(0, 8)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Button
              variant="outline"
              className="flex-1 rounded-full h-12 font-bold"
              onClick={onClose}
            >
              Fechar
            </Button>

            <Button
              className="flex-1 rounded-full h-12 font-bold bg-brand text-white"
              onClick={() => onGoToTarget(n)}
            >
              Ver pedido
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
