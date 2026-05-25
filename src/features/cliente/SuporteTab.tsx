import React, { useState, useEffect } from "react";
import { HeadphonesIcon, Send, MessageSquare, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface Ticket {
  id: string;
  assunto: string;
  mensagem: string;
  status: "aberto" | "em_andamento" | "resolvido";
  created_at: string;
}

export function SuporteTab() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const loadTickets = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("suporte_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[SuporteTab] load suporte_tickets failed", {
        table: "suporte_tickets",
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    }
    if (data) setTickets(data as Ticket[]);
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !assunto.trim() || !mensagem.trim()) return;
    
    setEnviando(true);
    const { data, error } = await (supabase as any)
      .from("suporte_tickets")
      .insert({
        user_id: user.id,
        assunto,
        mensagem
      })
      .select()
      .single();

    if (!error && data) {
      setTickets([data as Ticket, ...tickets]);
      setIsOpening(false);
      setAssunto("");
      setMensagem("");
      import("sonner").then((m) => m.toast.success("Mensagem enviada com sucesso! Nossa equipe retornará em breve."));
    } else {
      console.error("[SuporteTab] insert suporte_tickets failed", {
        table: "suporte_tickets",
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      import("sonner").then((m) => m.toast.error("Erro ao enviar mensagem. Tente novamente."));
    }
    setEnviando(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aberto":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-widest"><Clock className="h-3 w-3" /> Aguardando Atendimento</span>;
      case "em_andamento":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-widest"><MessageSquare className="h-3 w-3" /> Em Análise</span>;
      case "resolvido":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-green-100 text-green-800 uppercase tracking-widest"><CheckCircle2 className="h-3 w-3" /> Resolvido</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-brand/10 flex items-center justify-center">
            <HeadphonesIcon className="h-6 w-6 text-brand" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">Central de Ajuda</h2>
            <p className="text-muted-foreground text-sm">
              Precisa de ajuda? Fale diretamente com nossa equipe.
            </p>
          </div>
        </div>
        {!isOpening && (
          <Button 
            className="rounded-xl font-bold bg-brand text-white shadow-md hover:bg-brand/90"
            onClick={() => setIsOpening(true)}
          >
            Abrir Chamado
          </Button>
        )}
      </div>

      {isOpening && (
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-brand" /> Nova Mensagem para o Suporte
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Assunto
              </label>
              <input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex: Dúvida sobre pagamento, Problema com um profissional..."
                className="w-full text-sm font-medium pb-2 border-b border-border focus:outline-none focus:border-brand transition-colors bg-transparent"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Como podemos te ajudar?
              </label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Descreva detalhadamente o que aconteceu..."
                className="w-full min-h-[120px] p-4 text-sm font-medium rounded-2xl border border-border focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all resize-none bg-slate-50"
                required
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                className="rounded-xl font-bold"
                onClick={() => setIsOpening(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={enviando || !assunto.trim() || !mensagem.trim()}
                className="rounded-xl font-bold bg-brand text-white flex-1 flex items-center justify-center gap-2"
              >
                {enviando ? "Enviando..." : <><Send className="h-4 w-4" /> Enviar Mensagem</>}
              </Button>
            </div>
          </form>
        </section>
      )}

      <div className="space-y-4">
        <h3 className="font-bold text-lg px-2">Seus Chamados</h3>
        {loading ? (
           <div className="flex justify-center py-8">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
           </div>
        ) : tickets.length === 0 ? (
          <div className="bg-slate-50 rounded-[2rem] border border-dashed border-border p-12 text-center text-muted-foreground text-sm">
            Nenhum chamado de suporte aberto. Se precisar de algo, estamos à disposição!
          </div>
        ) : (
          tickets.map(ticket => (
            <div key={ticket.id} className="bg-white rounded-[1.5rem] p-6 border border-border shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h4 className="font-bold text-slate-800">{ticket.assunto}</h4>
                  {getStatusBadge(ticket.status)}
                </div>
                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{ticket.mensagem}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase pt-2">
                  Enviado em {new Date(ticket.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
