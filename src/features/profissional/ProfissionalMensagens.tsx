import React, { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chat } from "@/components/Chat";
import { useMinhasConversas, formatHoraRelativa, type Conversa } from "@/hooks/useMinhasConversas";

export function ProfissionalMensagens() {
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
        to: "/profissional",
        search: (prev: any) => ({ ...prev, orcamentoId: undefined }),
        replace: true,
      });
    }
  };

  useEffect(() => {
    const oid = searchParams?.orcamentoId;
    if (!oid || loading) return;
    const c = conversas.find((x) => x.orcamentoId === oid);
    if (c && (!aberta || aberta.orcamentoId !== oid)) {
      abrir(c);
    }
  }, [searchParams?.orcamentoId, loading, conversas]);

  if (!loading && conversas.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in duration-700">
        <h2 className="text-2xl font-bold tracking-tight">Mensagens</h2>
        <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300">
          <MessageCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">
            Nenhuma conversa ainda. As mensagens dos seus pedidos aparecem aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mensagens</h2>
        <p className="text-sm text-muted-foreground">
          Conversas com clientes sobre seus pedidos.
        </p>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando…</div>
        ) : (
          conversas.map((c) => (
            <button
              key={c.orcamentoId}
              onClick={() => abrir(c)}
              className={`w-full text-left flex items-start gap-4 p-4 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                c.naoLidas > 0
                  ? "bg-brand/5 border-brand/20 shadow-sm"
                  : "bg-white border-border"
              }`}
            >
              <div
                className={`mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                  c.naoLidas > 0 ? "bg-brand/15" : "bg-slate-100"
                }`}
              >
                <MessageCircle
                  className={`h-4 w-4 ${c.naoLidas > 0 ? "text-brand" : "text-slate-400"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm font-bold truncate ${c.naoLidas > 0 ? "text-brand" : "text-foreground"}`}
                  >
                    {c.contraparteNome}
                  </p>
                  {c.naoLidas > 0 && (
                    <span className="shrink-0 text-[10px] font-bold bg-brand text-white rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {c.naoLidas}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                  {c.serviceName}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed truncate">
                  {c.ultimaMensagem}
                </p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">
                  {formatHoraRelativa(c.ultimaData)}
                </p>
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
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
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
