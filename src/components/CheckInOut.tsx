import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPosition } from "@/lib/geo-current";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, LogIn, LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";

export function CheckInOut({
  orcamentoId,
  checkinEm,
  checkoutEm,
  onChange,
}: {
  orcamentoId: string;
  checkinEm: string | null;
  checkoutEm: string | null;
  onChange?: () => void;
}) {
  const [busy, setBusy] = useState<"in" | "out" | null>(null);

  const acao = async (tipo: "in" | "out") => {
    setBusy(tipo);
    const coords = await getCurrentPosition();
    const patch = tipo === "in"
      ? { checkin_em: new Date().toISOString(), checkin_lat: coords?.lat ?? null, checkin_lng: coords?.lng ?? null }
      : { checkout_em: new Date().toISOString(), checkout_lat: coords?.lat ?? null, checkout_lng: coords?.lng ?? null };
    const { error } = await supabase.from("orcamentos").update(patch).eq("id", orcamentoId);
    setBusy(null);
    if (error) { toast.error("Falha ao registrar. Tente novamente."); return; }
    toast.success(tipo === "in" ? "Check-in registrado!" : "Check-out registrado!");
    onChange?.();
  };

  return (
    <div className="space-y-2 p-3 rounded-2xl border border-border bg-slate-50">
      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1">
        <MapPin className="h-3 w-3" /> Presença no local
      </p>
      <div className="grid grid-cols-2 gap-2">
        {checkinEm ? (
          <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" /> Chegou {new Date(checkinEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => acao("in")} disabled={!!busy} className="rounded-full text-xs h-9">
            {busy === "in" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><LogIn className="h-3 w-3 mr-1" /> Check-in</>}
          </Button>
        )}
        {checkoutEm ? (
          <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saiu {new Date(checkoutEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => acao("out")} disabled={!!busy || !checkinEm} className="rounded-full text-xs h-9">
            {busy === "out" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><LogOut className="h-3 w-3 mr-1" /> Check-out</>}
          </Button>
        )}
      </div>
    </div>
  );
}
