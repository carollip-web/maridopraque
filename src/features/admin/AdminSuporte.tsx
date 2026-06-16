import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";

type TicketStatus = "aberto" | "em_andamento" | "resolvido";

export function AdminSuporte() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"Todos" | TicketStatus>("Todos");
  
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [respostas, setRespostas] = useState<any[]>([]);
  const [loadingRespostas, setLoadingRespostas] = useState(false);
  const [novaResposta, setNovaResposta] = useState("");
  const [enviando, setEnviando] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    let query = supabase
      .from("suporte_tickets")
      .select(`
        *,
        profiles!suporte_tickets_user_id_fkey(nome)
      `)
      .order("updated_at", { ascending: false });

    if (filter !== "Todos") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar tickets: " + error.message);
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  const loadTicketData = async (ticket: any) => {
    setSelectedTicket(ticket);
    setLoadingRespostas(true);
    const { data, error } = await supabase
      .from("suporte_respostas")
      .select(`*, profiles!suporte_respostas_autor_id_fkey(nome)`)
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
      
    if (error) {
      toast.error("Erro ao carregar respostas: " + error.message);
    } else {
      setRespostas(data || []);
    }
    setLoadingRespostas(false);
  };

  const handleResponder = async () => {
    if (!novaResposta.trim() || !user || !selectedTicket) return;
    setEnviando(true);
    
    try {
      const { error: respError } = await supabase
        .from("suporte_respostas")
        .insert({
          ticket_id: selectedTicket.id,
          autor_id: user.id,
          mensagem: novaResposta.trim()
        });
      if (respError) throw respError;

      if (selectedTicket.status === "aberto") {
        await supabase
          .from("suporte_tickets")
          .update({ status: "em_andamento", updated_at: new Date().toISOString() })
          .eq("id", selectedTicket.id);
      } else {
        await supabase
          .from("suporte_tickets")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", selectedTicket.id);
      }

      await supabase
        .from("notificacoes")
        .insert({
          user_id: selectedTicket.user_id,
          titulo: "Resposta do suporte",
          mensagem: `Seu chamado '${selectedTicket.assunto}' recebeu uma resposta`,
          link: "/cliente?tab=suporte"
        });

      toast.success("Resposta enviada!");
      setNovaResposta("");
      await loadTicketData(selectedTicket);
      fetchTickets();
    } catch (e: any) {
      toast.error("Erro ao enviar resposta: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleMarcarResolvido = async () => {
    if (!selectedTicket) return;
    try {
      await supabase
        .from("suporte_tickets")
        .update({ status: "resolvido", updated_at: new Date().toISOString() })
        .eq("id", selectedTicket.id);
        
      await supabase
        .from("notificacoes")
        .insert({
          user_id: selectedTicket.user_id,
          titulo: "Chamado resolvido",
          mensagem: `Seu chamado '${selectedTicket.assunto}' foi resolvido`,
          link: "/cliente?tab=suporte"
        });
        
      toast.success("Ticket marcado como resolvido!");
      setSelectedTicket(null);
      fetchTickets();
    } catch (e: any) {
      toast.error("Erro ao atualizar ticket: " + e.message);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "aberto": return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Aberto</span>;
      case "em_andamento": return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Em andamento</span>;
      case "resolvido": return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Resolvido</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-border shadow-soft">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Suporte ao Cliente</h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie os tickets abertos pelos usuários.</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "Todos" | TicketStatus)}
          className="p-3 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-sm"
        >
          <option value="Todos">Todos os Tickets</option>
          <option value="aberto">Abertos</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="resolvido">Resolvidos</option>
        </select>
      </div>

      {loading ? (
        <div className="p-8 text-slate-500 text-center font-medium animate-pulse bg-white rounded-3xl border border-slate-100">Carregando tickets...</div>
      ) : tickets.length === 0 ? (
        <p className="text-slate-500 bg-white p-12 rounded-3xl border border-slate-200 text-center font-medium shadow-sm">
          Nenhum ticket encontrado.
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-soft">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-200 tracking-widest">
                <tr>
                  <th className="px-6 py-5 whitespace-nowrap">Assunto</th>
                  <th className="px-6 py-5 whitespace-nowrap">Cliente</th>
                  <th className="px-6 py-5 whitespace-nowrap">Status</th>
                  <th className="px-6 py-5 whitespace-nowrap">Criado em</th>
                  <th className="px-6 py-5 whitespace-nowrap">Atualizado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map(t => (
                  <tr 
                    key={t.id} 
                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                    onClick={() => loadTicketData(t)}
                  >
                    <td className="px-6 py-5 font-bold text-slate-800 group-hover:text-brand transition-colors">{t.assunto}</td>
                    <td className="px-6 py-5 text-slate-600 font-medium">{t.profiles?.nome || "Desconhecido"}</td>
                    <td className="px-6 py-5">{statusBadge(t.status)}</td>
                    <td className="px-6 py-5 text-slate-500 font-medium">
                      {new Date(t.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="px-6 py-5 text-slate-500 font-medium">
                      {new Date(t.updated_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit'})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedTicket && (
        <Sheet open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0 flex flex-col bg-slate-50/50">
            <SheetHeader className="px-6 py-6 border-b border-slate-200 bg-white shadow-sm z-10 sticky top-0">
              <SheetTitle className="text-xl font-bold flex items-center gap-3">
                Ticket #{selectedTicket.id.split('-')[0]}
                {statusBadge(selectedTicket.status)}
              </SheetTitle>
              <div className="mt-2 space-y-1">
                <p className="text-slate-600 font-medium">Assunto: <span className="font-bold text-slate-900">{selectedTicket.assunto}</span></p>
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  Cliente: <span className="text-slate-700">{selectedTicket.profiles?.nome || "Desconhecido"}</span>
                </p>
              </div>
            </SheetHeader>
            
            <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group">
                <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 absolute top-5 right-5">Mensagem Original</p>
                <div className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                    {(selectedTicket.profiles?.nome || "C")[0].toUpperCase()}
                  </div>
                  {selectedTicket.profiles?.nome || "Cliente"}
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedTicket.mensagem}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-4 text-right">
                  {new Date(selectedTicket.created_at).toLocaleString("pt-BR")}
                </p>
              </div>

              {loadingRespostas ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                respostas.map(r => {
                  const isAdmin = r.autor_id !== selectedTicket.user_id;
                  return (
                    <div 
                      key={r.id} 
                      className={`p-5 rounded-2xl shadow-sm border ${isAdmin ? "bg-brand/5 border-brand/20 ml-8" : "bg-white border-slate-200 mr-8"}`}
                    >
                      <div className={`font-bold text-sm mb-3 flex items-center gap-2 ${isAdmin ? "text-brand" : "text-slate-800"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAdmin ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>
                          {(r.profiles?.nome || "A")[0].toUpperCase()}
                        </div>
                        {r.profiles?.nome || "Desconhecido"} 
                        {isAdmin && <span className="text-[9px] uppercase tracking-widest bg-brand text-white px-2 py-0.5 rounded-full ml-auto">Equipe</span>}
                      </div>
                      <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isAdmin ? "text-slate-800" : "text-slate-700"}`}>{r.mensagem}</p>
                      <p className={`text-[10px] font-bold mt-4 text-right ${isAdmin ? "text-brand/60" : "text-slate-400"}`}>
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-6 bg-white border-t border-slate-200 shadow-lg sticky bottom-0 z-10">
              {selectedTicket.status !== "resolvido" ? (
                <div className="space-y-4">
                  <Textarea
                    placeholder="Escreva sua resposta para o cliente..."
                    value={novaResposta}
                    onChange={(e) => setNovaResposta(e.target.value)}
                    className="min-h-[120px] resize-none focus:ring-brand/20 bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-medium"
                  />
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleResponder} 
                      disabled={enviando || !novaResposta.trim()} 
                      className="flex-1 bg-brand text-white font-bold rounded-xl h-12 shadow-sm"
                    >
                      {enviando ? "Enviando..." : "Enviar Resposta"}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleMarcarResolvido} 
                      className="flex-1 font-bold rounded-xl h-12 border-slate-200 text-slate-700 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
                    >
                      Marcar como resolvido
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-5 text-green-700 font-bold bg-green-50 rounded-2xl border border-green-100 shadow-inner">
                  Chamado Resolvido
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
