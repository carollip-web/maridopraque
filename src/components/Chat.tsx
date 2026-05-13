import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Mensagem {
  id: string;
  remetente_id: string;
  destinatario_id: string;
  texto: string;
  created_at: string;
  lida: boolean;
}

interface ChatProps {
  orcamentoId: string;
  /** Id da outra ponta da conversa (cliente OU profissional) */
  contraparteId: string;
  contraparteNome?: string;
}

export function Chat({ orcamentoId, contraparteId, contraparteNome }: ChatProps) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("mensagens")
      .select("*")
      .eq("orcamento_id", orcamentoId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setMsgs((data as Mensagem[]) ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`msgs:${orcamentoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `orcamento_id=eq.${orcamentoId}`,
        },
        (payload) => {
          setMsgs((prev) =>
            prev.some((m) => m.id === (payload.new as Mensagem).id)
              ? prev
              : [...prev, payload.new as Mensagem],
          );
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [orcamentoId]);

  // Marca como lidas as mensagens recebidas
  useEffect(() => {
    if (!user) return;
    const naoLidas = msgs.filter((m) => m.destinatario_id === user.id && !m.lida).map((m) => m.id);
    if (naoLidas.length === 0) return;
    supabase.from("mensagens").update({ lida: true }).in("id", naoLidas).then();
  }, [msgs, user?.id]);

  // Auto-scroll
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const enviar = async () => {
    if (!user || !texto.trim()) return;
    setEnviando(true);
    const { error } = await supabase.from("mensagens").insert({
      orcamento_id: orcamentoId,
      remetente_id: user.id,
      destinatario_id: contraparteId,
      texto: texto.trim(),
    });
    setEnviando(false);
    if (!error) setTexto("");
  };

  return (
    <div className="flex flex-col h-[500px] max-h-[70vh] rounded-2xl border border-border bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-slate-50">
        <p className="text-sm font-bold text-slate-900">
          Conversa{contraparteNome ? ` com ${contraparteNome}` : ""}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
        {loading ? (
          <div className="grid place-items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : msgs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Inicie a conversa enviando uma mensagem abaixo.
          </p>
        ) : (
          msgs.map((m) => {
            const mine = m.remetente_id === user?.id;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm",
                    mine
                      ? "bg-brand text-white rounded-br-sm"
                      : "bg-white border border-border rounded-bl-sm",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                  <p
                    className={cn(
                      "text-[10px] mt-1",
                      mine ? "text-white/70" : "text-muted-foreground",
                    )}
                  >
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex gap-2 p-3 border-t border-border bg-white"
      >
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite sua mensagem…"
          disabled={enviando}
        />
        <Button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="bg-brand hover:bg-brand-700 rounded-full"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
