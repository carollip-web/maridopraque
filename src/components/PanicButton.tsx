import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentPosition } from "@/lib/geo-current";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PanicButton({ orcamentoId }: { orcamentoId?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [obs, setObs] = useState("");
  const [sending, setSending] = useState(false);

  const disparar = async () => {
    if (!user) return;
    setSending(true);
    const coords = await getCurrentPosition();
    const { error } = await supabase.from("panico_eventos").insert({
      user_id: user.id,
      orcamento_id: orcamentoId ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      observacao: obs || null,
    });
    setSending(false);
    if (error) {
      toast.error("Falha ao registrar. Ligue para 190 imediatamente.");
      return;
    }
    toast.success("Alerta enviado. A equipe de segurança foi notificada.");
    setOpen(false);
    setObs("");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 shadow-2xl text-white grid place-items-center transition-transform hover:scale-110 active:scale-95"
        aria-label="Botão de pânico"
        title="Botão de pânico"
      >
        <AlertTriangle className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] grid place-items-center p-4 animate-in fade-in">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !sending && setOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-red-600 font-black text-lg mb-2">
              <AlertTriangle className="h-5 w-5" /> Alerta de emergência
            </div>
            <p className="text-sm text-slate-700 mb-4">
              Em caso de risco imediato, ligue para{" "}
              <a href="tel:190" className="text-red-600 font-bold underline">
                190
              </a>
              . Vamos registrar sua localização e avisar a equipe de segurança.
            </p>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="O que está acontecendo? (opcional)"
              className="w-full h-20 p-3 rounded-xl border border-border bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={sending}
                className="rounded-full"
              >
                Cancelar
              </Button>
              <Button
                onClick={disparar}
                disabled={sending}
                className="bg-red-600 hover:bg-red-700 text-white rounded-full font-bold"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disparar alerta"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
