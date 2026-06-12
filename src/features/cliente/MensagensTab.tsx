import React, { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chat } from "@/components/Chat";
import { useMinhasConversas, formatHoraRelativa, type Conversa } from "@/hooks/useMinhasConversas";

export function MensagensTab() {
  const { conversas, loading, marcarConversaLida } = useMinhasConversas();
  const searchParams = useSearch({ strict: false }) as any;
  const navigate = useNavigate();
  const [aberta, setAberta] = useState<Conversa | null>(null);

  const abrir = (c: Conversa) => {
    setAberta(c);
    marcarConversaLida(c.orcamentoId);
  };

  const fechar = () => {
    setAberta(null);
    if (searchParams?.orcamentoId) {
      navigate({
        to: "/cliente",
        search: (prev: any) => ({ ...prev, orcamentoId: undefined }),
        replace: true,
      });
    }
  };

  // Deep link: ?orcamentoId=X abre conversa
  useEffect(() => {
    const oid = searchParams?.orcamentoId;
    if (!oid || loading) return;
    const c = conversas.find((x) => x.orcamentoId === oid);
    if (c && (!aberta || aberta.orcamentoId !== oid)) {
      abrir(c);
    }
  }, [searchParams?.orcamentoId, loading, conversas]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Mensagens</h3>
      </div>

      <div className="bg-white rounded-[2rem] border border-border shadow-soft divide-y divide-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground font-medium">Carregando…</div>
        ) : conversas.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground font-medium">
            Nenhuma conversa ainda. As mensagens dos seus pedidos aparecem aqui.
          </div>
        ) : (
          conversas.map((c) => (
            <button
              key={c.orcamentoId}
              onClick={() => abrir(c)}
              className={`w-full text-left p-6 md:p-8 flex gap-5 transition-all cursor-pointer group hover:bg-slate-50 ${c.naoLidas > 0 ? "bg-[#fefaf9]" : "bg-white"}`}
            >
              <div className="mt-1 shrink-0">
                <div className="h-10 w-10 rounded-full bg-brand/10 grid place-items-center">
                  <MessageCircle className="h-5 w-5 text-brand" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p
                    className={`text-base font-bold transition-colors truncate ${c.naoLidas > 0 ? "text-[#b85c45]" : "text-slate-700"}`}
                  >
                    {c.contraparteNome}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider shrink-0">
                    {formatHoraRelativa(c.ultimaData)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground font-medium mb-1 truncate">
                  {c.serviceName}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground leading-relaxed truncate">
                    {c.ultimaMensagem}
                  </p>
                  {c.naoLidas > 0 && (
                    <span className="shrink-0 text-[10px] font-bold bg-brand text-white rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {c.naoLidas}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {aberta && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={fechar}
          />
          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-4">
              <Chat
                orcamentoId={aberta.orcamentoId}
                contraparteId={aberta.contraparteId}
                contraparteNome={aberta.contraparteNome}
              />
              <Button
                variant="ghost"
                onClick={fechar}
                className="w-full mt-2 text-xs uppercase tracking-widest font-bold"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
