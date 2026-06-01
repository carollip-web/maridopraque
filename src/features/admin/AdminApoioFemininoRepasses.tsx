import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Check, Copy, User, CreditCard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminApoioFemininoRepasses() {
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      // Busca pagamentos pagos/aprovados do mercado pago
      const { data, error } = await supabase
        .from("pagamentos")
        .select(`
          *,
          orcamentos!inner(id, service_name, apoio_equipe_id)
        `)
        .eq("gateway", "mercado_pago")
        .in("status", ["paid", "approved"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filtra apenas os que tem apoio feminino
      const pagamentosApoio = (data || []).filter((p: any) => {
        const metadata = p.metadata || {};
        return metadata.valor_apoio_feminino > 0;
      });

      // Busca dados da equipe de apoio feminino (nova tabela)
      const equipeIds = pagamentosApoio.map((p: any) => p.orcamentos.apoio_equipe_id).filter(Boolean);

      let equipeMap: Record<string, any> = {};
      if (equipeIds.length > 0) {
        const { data: equipe, error: equipeErr } = await supabase
          .from("apoio_feminino_equipe")
          .select("id, nome, whatsapp, chave_pix")
          .in("id", equipeIds);

        if (!equipeErr && equipe) {
          equipe.forEach((e: any) => {
            equipeMap[e.id] = {
              nome: e.nome,
              chave_pix: e.chave_pix,
              pix_key_type: null,
              whatsapp: e.whatsapp,
            };
          });
        }
      }

      setPagamentos(pagamentosApoio.map((p: any) => ({
        ...p,
        apoio_prof: p.orcamentos.apoio_equipe_id ? equipeMap[p.orcamentos.apoio_equipe_id] : null
      })));

    } catch (err: any) {
      console.error("Erro ao carregar repasses de apoio", err);
      toast.error("Erro ao carregar repasses de apoio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success("Chave PIX copiada!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const markAsPaid = async (pagamentoId: string) => {
    try {
      const pag = pagamentos.find(p => p.id === pagamentoId);
      if (!pag) return;
      
      const newMetadata = {
        ...pag.metadata,
        apoio_repassado_em: new Date().toISOString()
      };

      const { error } = await supabase
        .from("pagamentos")
        .update({ metadata: newMetadata })
        .eq("id", pagamentoId);
        
      if (error) throw error;
      toast.success("Repasse marcado como concluído!");
      loadData();
    } catch (e: any) {
      toast.error("Erro ao atualizar repasse.");
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Carregando repasses...</div>;
  }

  if (pagamentos.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-xl">
        <p className="text-slate-500 font-medium">Nenhum repasse de Apoio Feminino pendente ou registrado.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800 mb-6">Controle de PIX (Apoio Feminino)</h2>
      
      <div className="overflow-x-auto -mx-6">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider bg-slate-50/50">
              <th className="px-6 py-4">Serviço / ID Pagamento</th>
              <th className="px-6 py-4">Profissional (Apoio)</th>
              <th className="px-6 py-4">Dados do PIX</th>
              <th className="px-6 py-4 text-right">Valor do Repasse</th>
              <th className="px-6 py-4 text-center">Status PIX</th>
              <th className="px-6 py-4">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagamentos.map((pag) => {
              const repassadoEm = pag.metadata?.apoio_repassado_em;
              const valor = pag.metadata?.valor_apoio_feminino || 0;
              const prof = pag.apoio_prof;

              return (
                <tr key={pag.id} className="hover:bg-slate-50/40 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm text-slate-900">{pag.orcamentos.service_name}</div>
                    <div className="text-xs font-mono text-slate-400 mt-1">#{pag.id.slice(0,8)}</div>
                  </td>
                  <td className="px-6 py-4">
                    {prof ? (
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <User className="h-4 w-4" /> {prof.nome || "Nome não encontrado"}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Vaga em aberto / Não assumida</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {prof?.chave_pix ? (
                      <div className="flex items-center gap-2">
                        <div className="text-xs">
                          <p className="font-bold text-slate-600 uppercase text-[10px] tracking-wider mb-0.5">{prof.pix_key_type}</p>
                          <p className="font-mono text-slate-900">{prof.chave_pix}</p>
                        </div>
                        <button 
                          onClick={() => handleCopy(prof.chave_pix)}
                          className="p-1.5 bg-slate-100 text-slate-500 rounded hover:bg-brand hover:text-white transition"
                        >
                          {copiedId === prof.chave_pix ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    ) : (
                       <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded font-bold">Sem PIX cadastrado</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-black text-sm text-emerald-600">
                      R$ {Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {repassadoEm ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                        <Check className="h-3 w-3" /> Repassado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                        Aguardando PIX
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                     {!repassadoEm && prof?.chave_pix && (
                       <Button size="sm" onClick={() => markAsPaid(pag.id)} className="bg-slate-900 text-white font-bold h-8 text-xs hover:bg-slate-800">
                         Marcar como Pago
                       </Button>
                     )}
                     {repassadoEm && (
                       <div className="text-[10px] text-slate-400 text-center font-medium">
                         Em: {new Date(repassadoEm).toLocaleDateString("pt-BR")}
                       </div>
                     )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
