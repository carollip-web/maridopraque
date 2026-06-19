import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Star, Loader2, MessageSquareReply, CheckCircle2, X } from "lucide-react";
import { NivelBadge } from "@/components/NivelBadge";

type AvaliacaoRow = {
  id: string;
  nota: number;
  comentario: string | null;
  created_at: string;
  resposta_profissional: string | null;
  resposta_em: string | null;
  cliente_nome: string | null;
  service_name: string | null;
};

type Avaliacao = {
  id: string;
  nota: number;
  comentario: string | null;
  created_at: string;
  resposta_profissional: string | null;
  resposta_em: string | null;
  cliente_nome: string;
  service_name: string;
};

const EMPTY: Avaliacao[] = [];

export function ProfissionalAvaliacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const [filtro, setFiltro] = useState<"todas" | "pendentes" | "5" | "4" | "baixas">("todas");
  const [editing, setEditing] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");

  const avsQuery = useQuery({
    queryKey: ["profissional", "avaliacoes-detalhadas", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Avaliacao[]> => {
      const { data: avals } = await supabase
        .from("avaliacoes_publicas")
        .select(
          "id, nota, comentario, created_at, resposta_profissional, resposta_em, cliente_nome, service_name",
        )
        .eq("profissional_id", userId!)
        .order("created_at", { ascending: false });
      const list = (avals ?? []) as unknown as AvaliacaoRow[];
      return list.map((a) => ({
        ...a,
        cliente_nome: a.cliente_nome ?? "Cliente",
        service_name: a.service_name ?? "Serviço",
      }));
    },
  });

  const avs = avsQuery.data ?? EMPTY;
  const loading = avsQuery.isLoading;

  const perfilQuery = useQuery({
    queryKey: ["profissional", "perfil-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("total_servicos_pagos")
        .eq("id", userId!)
        .single();
      return data;
    },
  });

  const responderMutation = useMutation({
    mutationFn: async ({ id, texto }: { id: string; texto: string }) => {
      const { error } = await supabase
        .from("avaliacoes")
        .update({
          resposta_profissional: texto,
          resposta_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resposta publicada!");
      setEditing(null);
      setResposta("");
      queryClient.invalidateQueries({
        queryKey: ["profissional", "avaliacoes-detalhadas", userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["profissional", "avaliacoes", userId],
      });
    },
    onError: (err: unknown) => {
      toast.error("Erro ao publicar resposta", { description: (err as Error)?.message });
    },
  });

  const filtradas = useMemo(() => {
    return avs.filter((a) => {
      if (filtro === "pendentes") return !a.resposta_profissional;
      if (filtro === "5") return a.nota === 5;
      if (filtro === "4") return a.nota === 4;
      if (filtro === "baixas") return a.nota <= 3;
      return true;
    });
  }, [avs, filtro]);

  const stats = useMemo(() => {
    if (avs.length === 0) return { media: 0, total: 0, dist: [0, 0, 0, 0, 0] as number[] };
    const total = avs.length;
    const soma = avs.reduce((a, x) => a + x.nota, 0);
    const dist = [0, 0, 0, 0, 0];
    avs.forEach((a) => {
      if (a.nota >= 1 && a.nota <= 5) dist[a.nota - 1]++;
    });
    return { media: soma / total, total, dist };
  }, [avs]);

  const startEdit = (a: Avaliacao) => {
    setEditing(a.id);
    setResposta(a.resposta_profissional ?? "");
  };

  const cancelEdit = () => {
    setEditing(null);
    setResposta("");
  };

  const salvarResposta = (id: string) => {
    const txt = resposta.trim();
    if (txt.length < 5) {
      toast.error("Sua resposta precisa ter pelo menos 5 caracteres.");
      return;
    }
    responderMutation.mutate({ id, texto: txt });
  };

  const saving = responderMutation.isPending;

  if (loading) {
    return (
      <div className="py-24 grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Avaliações recebidas</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Responder avaliações mostra profissionalismo e ajuda futuros clientes.
        </p>
      </div>

      {avs.length === 0 ? (
        <div className="rounded-3xl bg-white border border-dashed border-border p-12 text-center">
          <Star className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Você ainda não recebeu avaliações. Conclua serviços para começar.
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-6">
            <div className="grid sm:grid-cols-2 gap-6 items-center">
              <div className="text-center sm:text-left">
                <p className="text-xs uppercase tracking-widest text-amber-700 font-bold">
                  Média geral
                </p>
                <div className="flex items-baseline gap-2 justify-center sm:justify-start mt-1">
                  <span className="text-5xl font-bold text-slate-900 tabular-nums">
                    {stats.media.toFixed(1)}
                  </span>
                  <span className="text-lg text-muted-foreground">/ 5</span>
                </div>
                <div className="flex justify-center sm:justify-start gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-4 w-4 ${n <= Math.round(stats.media) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.total} {stats.total === 1 ? "avaliação" : "avaliações"}
                </p>
              </div>
              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((n) => {
                  const qtd = stats.dist[n - 1];
                  const pct = stats.total ? (qtd / stats.total) * 100 : 0;
                  return (
                    <div key={n} className="flex items-center gap-2 text-xs">
                      <span className="w-3 font-bold tabular-nums">{n}</span>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                      <div className="flex-1 h-2 rounded-full bg-white overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-muted-foreground tabular-nums">
                        {qtd}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Badge de Nível do Profissional */}
          <div className="mt-4">
            <NivelBadge 
              concluidos={perfilQuery.data?.total_servicos_pagos ?? 0} 
              notaMedia={stats.media} 
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { v: "todas", l: "Todas" },
              { v: "pendentes", l: "Sem resposta" },
              { v: "5", l: "5 estrelas" },
              { v: "4", l: "4 estrelas" },
              { v: "baixas", l: "≤ 3 estrelas" },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFiltro(f.v as "todas" | "pendentes" | "5" | "4" | "baixas")}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtro === f.v ? "bg-brand text-white border-brand" : "bg-white text-slate-700 border-slate-200 hover:border-brand"}`}
              >
                {f.l}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtradas.length === 0 && (
              <div className="rounded-2xl bg-white border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhuma avaliação corresponde ao filtro.
              </div>
            )}
            {filtradas.map((a) => (
              <article
                key={a.id}
                className="rounded-2xl bg-white border border-border p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-4 w-4 ${n <= a.nota ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1">{a.cliente_nome}</p>
                    <p className="text-xs text-muted-foreground">{a.service_name}</p>
                  </div>
                  {!a.resposta_profissional && editing !== a.id && (
                    <Button
                      onClick={() => startEdit(a)}
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs"
                    >
                      <MessageSquareReply className="h-3.5 w-3.5 mr-1" /> Responder
                    </Button>
                  )}
                </div>

                {a.comentario && (
                  <p className="text-sm text-slate-700 mt-3 italic">"{a.comentario}"</p>
                )}

                {a.resposta_profissional && editing !== a.id && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border-l-4 border-brand">
                    <p className="text-[11px] uppercase font-bold text-brand mb-1">Sua resposta</p>
                    <p className="text-sm text-slate-700">{a.resposta_profissional}</p>
                    {a.resposta_em && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        em {new Date(a.resposta_em).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    <button
                      onClick={() => startEdit(a)}
                      className="text-[11px] text-brand font-bold hover:underline mt-1"
                    >
                      Editar resposta
                    </button>
                  </div>
                )}

                {editing === a.id && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={resposta}
                      onChange={(e) => setResposta(e.target.value)}
                      rows={3}
                      placeholder="Agradeça, esclareça pontos, mostre profissionalismo. Esta resposta será pública."
                      maxLength={500}
                    />
                    <p className="text-[10px] text-muted-foreground text-right">
                      {resposta.length}/500
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button onClick={cancelEdit} variant="ghost" size="sm" disabled={saving}>
                        <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                      <Button
                        onClick={() => salvarResposta(a.id)}
                        size="sm"
                        disabled={saving}
                        className="bg-brand hover:bg-brand-700 text-white rounded-full"
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        )}
                        Publicar
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
