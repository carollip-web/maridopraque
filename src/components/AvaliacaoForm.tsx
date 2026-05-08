import { useEffect, useState } from "react";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  orcamentoId: string;
  clienteId: string;
  profissionalId: string | null;
}

export function AvaliacaoForm({ orcamentoId, clienteId, profissionalId }: Props) {
  const [nota, setNota] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviada, setEnviada] = useState<{ nota: number; comentario: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("avaliacoes")
        .select("nota, comentario")
        .eq("orcamento_id", orcamentoId)
        .maybeSingle();
      if (data) setEnviada(data as any);
    })();
  }, [orcamentoId]);

  if (enviada) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-3.5 w-3.5 ${i < enviada.nota ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
          ))}
        </div>
        <span className="text-muted-foreground">Avaliado</span>
      </div>
    );
  }

  const submit = async () => {
    if (nota < 1) {
      toast.error("Escolha uma nota de 1 a 5");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("avaliacoes").insert({
      orcamento_id: orcamentoId,
      cliente_id: clienteId,
      profissional_id: profissionalId,
      nota,
      comentario: comentario.trim() || null,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível enviar a avaliação");
      return;
    }
    setEnviada({ nota, comentario: comentario.trim() || null });
    toast.success("Obrigado pela sua avaliação!");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const v = i + 1;
          const active = (hover || nota) >= v;
          return (
            <button
              key={v}
              type="button"
              onMouseEnter={() => setHover(v)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setNota(v)}
              className="p-0.5"
              aria-label={`Dar ${v} estrelas`}
            >
              <Star className={`h-5 w-5 transition-colors ${active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
            </button>
          );
        })}
      </div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value.slice(0, 500))}
        placeholder="Conte como foi (opcional)"
        className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        rows={2}
        maxLength={500}
      />
      <Button onClick={submit} disabled={loading || nota < 1} size="sm" className="rounded-full bg-brand text-brand-foreground font-bold">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar avaliação"}
      </Button>
    </div>
  );
}
