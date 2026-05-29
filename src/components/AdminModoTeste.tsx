import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Database, RotateCcw, Copy, Check, Play, LogIn } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { criarCenarioTestePagamento } from "@/lib/orcamentos.functions";

const TEST_EMAIL_DOMAIN = "teste.maridopraque.local";

export function AdminModoTeste() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [creatingScenario, setCreatingScenario] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const criarTeste = useServerFn(criarCenarioTestePagamento);

  const { data: contas } = useQuery({
    queryKey: ["test-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("is_test", true)
        .order("email");
      if (error) throw error;
      const ids = (data ?? []).map((p) => p.id);
      if (!ids.length) return [];
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      return (data ?? []).map((p) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.id)?.role ?? "—",
      }));
    },
  });

  const { data: pedidos } = useQuery({
    queryKey: ["test-orcamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, service_name, status, valor, cliente_id, profissional_id")
        .eq("is_test", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const callFn = async (name: string, body: any = {}) => {
    const { data, error } = await supabase.functions.invoke(name, {
      body,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const r = await callFn("seed-test-data");
      toast.success(
        `Seed concluído: ${r.contas?.length ?? 0} contas, ${r.pedidos_criados ?? 0} pedidos.`,
      );
      qc.invalidateQueries({ queryKey: ["test-accounts"] });
      qc.invalidateQueries({ queryKey: ["test-orcamentos"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Apagar TODOS os dados de teste (usuários e pedidos)? Esta ação não pode ser desfeita.",
      )
    )
      return;
    setResetting(true);
    try {
      const r = await callFn("reset-test-data");
      toast.success(`Removidos: ${r.usuarios_removidos} usuários, ${r.pedidos_removidos} pedidos.`);
      qc.invalidateQueries({ queryKey: ["test-accounts"] });
      qc.invalidateQueries({ queryKey: ["test-orcamentos"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResetting(false);
    }
  };

  const advance = async (orcId: string, status: string, extra: Record<string, any> = {}) => {
    setAdvancing(orcId + status);
    try {
      const { error } = await supabase
        .from("orcamentos")
        .update({ status: status as any, ...extra })
        .eq("id", orcId);
      if (error) throw error;
      toast.success(`Pedido → ${status}`);
      qc.invalidateQueries({ queryKey: ["test-orcamentos"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdvancing(null);
    }
  };

  const copyCreds = (email: string) => {
    navigator.clipboard.writeText(`${email} / Teste@2026!`);
    setCopied(email);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Modo Teste</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie dados de teste, simule fluxos e valide integrações entre cliente, profissional e
          admin. Senha padrão:{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded">Teste@2026!</code>
        </p>
      </div>

      {/* Seed / Reset */}
      <div className="bg-white rounded-2xl border border-border p-6 flex gap-3 flex-wrap">
        <Button onClick={handleSeed} disabled={seeding} className="gap-2">
          {seeding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          Criar / atualizar dados de teste
        </Button>
        <Button onClick={handleReset} disabled={resetting} variant="destructive" className="gap-2">
          {resetting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Apagar dados de teste
        </Button>
        <Button
          onClick={async () => {
            setCreatingScenario(true);
            try {
              const r = await criarTeste();
              toast.success(
                "Cenário de pagamento criado! Verifique 'Meus Orçamentos' no modo Cliente.",
              );
              qc.invalidateQueries({ queryKey: ["test-orcamentos"] });
            } catch (e: any) {
              toast.error(e.message);
            } finally {
              setCreatingScenario(false);
            }
          }}
          disabled={creatingScenario}
          variant="outline"
          className="gap-2 border-brand text-brand hover:bg-brand/5"
        >
          {creatingScenario ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Criar cenário: Pagamento Real
        </Button>
      </div>

      {/* Contas */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="font-bold mb-4">Contas de teste ({contas?.length ?? 0})</h2>
        {!contas?.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma conta de teste. Clique em "Criar dados de teste".
          </p>
        ) : (
          <div className="space-y-2">
            {contas.map((c: any) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{c.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-brand/10 text-brand">
                  {c.role}
                </span>
                <button
                  onClick={() => copyCreds(c.email)}
                  className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-white border border-border"
                >
                  {copied === c.email ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Credenciais
                </button>
                <button
                  onClick={async () => {
                    try {
                      const r = await callFn("impersonate-user", {
                        target_user_id: c.id,
                        redirect_to:
                          window.location.origin +
                          (c.role === "profissional"
                            ? "/profissional"
                            : c.role === "admin"
                              ? "/admin"
                              : "/cliente"),
                      });
                      if (r.action_link) window.open(r.action_link, "_blank");
                      else toast.error("Link não retornado");
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                  className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90"
                >
                  <LogIn className="h-3 w-3" />
                  Entrar como
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pedidos */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="font-bold mb-4">Pedidos de teste ({pedidos?.length ?? 0})</h2>
        {!pedidos?.length ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido de teste.</p>
        ) : (
          <div className="space-y-2">
            {pedidos.map((p: any) => (
              <div key={p.id} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{p.service_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {p.id.slice(0, 8)}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-amber-100 text-amber-800">
                    {p.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.status === "customizado_pendente" && (
                    <ActionBtn
                      busy={advancing === p.id + "enviado"}
                      onClick={() => advance(p.id, "enviado", { valor: 250, valor_servico: 250 })}
                    >
                      → Enviar orçamento
                    </ActionBtn>
                  )}
                  {p.status === "enviado" && (
                    <ActionBtn
                      busy={advancing === p.id + "aprovado"}
                      onClick={() =>
                        advance(p.id, "aprovado", { data_aprovacao: new Date().toISOString() })
                      }
                    >
                      → Aprovar
                    </ActionBtn>
                  )}
                  {p.status === "aprovado" && (
                    <ActionBtn
                      busy={advancing === p.id + "agendado"}
                      onClick={() =>
                        advance(p.id, "agendado", {
                          data_agendada: new Date(Date.now() + 86400000).toISOString(),
                        })
                      }
                    >
                      → Agendar (amanhã)
                    </ActionBtn>
                  )}
                  {(p.status === "aprovado" || p.status === "agendado") && (
                    <ActionBtn
                      busy={advancing === p.id + "pago"}
                      onClick={() =>
                        advance(p.id, "pago", { data_pagamento: new Date().toISOString() })
                      }
                    >
                      → Marcar pago
                    </ActionBtn>
                  )}
                  {p.status === "pago" && (
                    <ActionBtn
                      busy={advancing === p.id + "concluido"}
                      onClick={() => advance(p.id, "concluido")}
                    >
                      → Concluir
                    </ActionBtn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-white border border-border hover:bg-brand hover:text-white hover:border-brand transition disabled:opacity-50 inline-flex items-center gap-1"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
      {children}
    </button>
  );
}
