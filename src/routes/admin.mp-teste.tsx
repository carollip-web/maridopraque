import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  CircleDot,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/admin/mp-teste")({
  component: MpTestePage,
  head: () => ({ meta: [{ title: "MP Smoke Test · Admin" }] }),
});

type Step = {
  step: string;
  at: string;
  http_status?: number;
  idempotency_key?: string;
  mp_id?: string | number | null;
  refund_id?: string | number | null;
  mp_status?: string | null;
  mp_status_detail?: string | null;
  captured?: boolean | null;
  refund_status?: string | null;
  transaction_amount_refunded?: number | null;
  amount?: number | null;
  ok?: boolean;
  [k: string]: unknown;
};

type SmokeResult = {
  ok: boolean;
  ambiente?: string;
  payment_id?: string;
  summary?: {
    autorizado?: string;
    capturado?: string;
    estornado?: boolean;
    status_final?: string;
  };
  steps?: Step[];
  error?: string;
  message?: string;
  mp_response?: unknown;
};

type LogRow = {
  id: string;
  created_at: string;
  ambiente: string;
  amount: number;
  payment_id: string | null;
  status_final: string | null;
  ok: boolean;
  error: string | null;
  message: string | null;
  steps: Step[];
  last_mp_response: unknown;
};

const AMOUNT = 1.0;

function MpTestePage() {
  const { isLoggedIn, isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "brick" | "running" | "done">(
    "idle",
  );
  const [result, setResult] = useState<SmokeResult | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const brickMountedRef = useRef(false);
  const brickControllerRef = useRef<any>(null);

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn || !isAdmin) navigate({ to: "/login" });
  }, [loading, isLoggedIn, isAdmin, navigate]);

  // Histórico (admins only — RLS já filtra)
  const logsQuery = useQuery({
    queryKey: ["mp-smoke-test-logs"],
    enabled: !!isAdmin,
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase
        .from("mp_smoke_test_logs" as any)
        .select(
          "id, created_at, ambiente, amount, payment_id, status_final, ok, error, message, steps, last_mp_response",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as unknown as LogRow[]) ?? [];
    },
  });

  const startTest = async () => {
    setErrMsg(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "mp-get-public-key",
      );
      if (error || !data?.publicKey) {
        setErrMsg("Não foi possível carregar a public key.");
        return;
      }
      setPublicKey(data.publicKey);
      setPhase("brick");
    } catch (e: any) {
      setErrMsg(e?.message || "Falha ao iniciar teste.");
    }
  };

  useEffect(() => {
    if (phase !== "brick" || !publicKey || brickMountedRef.current) return;
    let cancelled = false;

    async function ensureSdk() {
      if ((window as any).MercadoPago) return (window as any).MercadoPago;
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-mp-sdk="v2"]');
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () =>
            reject(new Error("SDK MP")),
          );
          return;
        }
        const s = document.createElement("script");
        s.src = "https://sdk.mercadopago.com/js/v2";
        s.async = true;
        s.dataset.mpSdk = "v2";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("SDK MP"));
        document.head.appendChild(s);
      });
      return (window as any).MercadoPago;
    }

    (async () => {
      try {
        const MP = await ensureSdk();
        if (cancelled) return;
        const mp = new MP(publicKey, { locale: "pt-BR" });
        const bricks = mp.bricks();
        brickMountedRef.current = true;
        brickControllerRef.current = await bricks.create(
          "cardPayment",
          "mp-smoke-brick",
          {
            initialization: {
              amount: AMOUNT,
              payer: { email: user?.email || "" },
            },
            customization: {
              paymentMethods: { maxInstallments: 1 },
              visual: { style: { theme: "default" } },
            },
            callbacks: {
              onReady: () => {},
              onError: (err: any) => {
                console.error("brick err", err);
                setErrMsg("Erro no formulário do cartão.");
              },
              onSubmit: async ({ formData }: any) => {
                try {
                  setPhase("running");
                  const { data, error } = await supabase.functions.invoke(
                    "mp-smoke-test",
                    { body: { card_token: formData.token, amount: AMOUNT } },
                  );
                  if (error) throw error;
                  setResult(data as SmokeResult);
                  setPhase("done");
                  queryClient.invalidateQueries({
                    queryKey: ["mp-smoke-test-logs"],
                  });
                  if ((data as SmokeResult)?.ok) {
                    toast.success("Smoke test concluído com sucesso");
                  } else {
                    toast.error("Smoke test falhou — veja detalhes abaixo");
                  }
                } catch (e: any) {
                  setErrMsg(e?.message || "Falha ao executar smoke test");
                  setPhase("done");
                  queryClient.invalidateQueries({
                    queryKey: ["mp-smoke-test-logs"],
                  });
                }
              },
            },
          },
        );
      } catch {
        if (!cancelled) setErrMsg("Falha ao montar formulário MP.");
      }
    })();

    return () => {
      cancelled = true;
      try {
        brickControllerRef.current?.unmount?.();
      } catch {}
      brickControllerRef.current = null;
      brickMountedRef.current = false;
    };
  }, [phase, publicKey, user?.email, queryClient]);

  const reset = () => {
    setResult(null);
    setErrMsg(null);
    setPhase("idle");
    setPublicKey(null);
  };

  if (loading) return null;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Mercado Pago · Smoke Test</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Cobra{" "}
          <strong>R$ {AMOUNT.toFixed(2).replace(".", ",")}</strong> em um
          cartão real, executa <em>autorizar → capturar → estornar →
          consultar status</em> e grava log persistente. Não cria pedido
          nem mexe em pagamentos do sistema.
        </p>
      </header>

      {phase === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle>Iniciar teste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Roda no <strong>ambiente atual</strong> definido por{" "}
                <code>MP_AMBIENTE</code>. Em produção, R$ 1,00 será cobrado
                de verdade e estornado em seguida.
              </div>
            </div>
            <Button onClick={startTest}>Carregar formulário do cartão</Button>
          </CardContent>
        </Card>
      )}

      {(phase === "brick" || phase === "running") && (
        <Card>
          <CardHeader>
            <CardTitle>
              {phase === "running"
                ? "Executando smoke test…"
                : "Tokenize o cartão"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div id="mp-smoke-brick" />
            {phase === "running" && (
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Autorizando, capturando e estornando R${" "}
                {AMOUNT.toFixed(2).replace(".", ",")}…
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {errMsg && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            {errMsg}
          </CardContent>
        </Card>
      )}

      {phase === "done" && result && (
        <ResultCard result={result} onReset={reset} />
      )}

      {/* Histórico */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Histórico de execuções</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logsQuery.refetch()}
            disabled={logsQuery.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${
                logsQuery.isFetching ? "animate-spin" : ""
              }`}
            />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {logsQuery.isLoading && (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          )}
          {logsQuery.error && (
            <div className="text-sm text-destructive">
              Erro: {(logsQuery.error as Error).message}
            </div>
          )}
          {logsQuery.data?.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Nenhuma execução ainda.
            </div>
          )}
          {logsQuery.data?.map((row) => <LogRowCard key={row.id} row={row} />)}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------
// Resultado da execução atual
// ---------------------------------------------------------------------
function ResultCard({
  result,
  onReset,
}: {
  result: SmokeResult;
  onReset: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {result.ok ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
          Resultado
        </CardTitle>
        <Badge variant={result.ok ? "default" : "destructive"}>
          {result.ok ? "OK" : "FALHA"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Info label="Ambiente" value={result.ambiente} />
          <Info label="Payment ID" value={result.payment_id} mono />
          <Info label="Status final" value={result.summary?.status_final} />
        </div>

        {result.error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-xs">
            <div className="font-semibold">{result.error}</div>
            {result.message && <div>{result.message}</div>}
          </div>
        )}

        <Timeline steps={result.steps ?? []} />

        {result.mp_response ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Última resposta sanitizada do MP
            </summary>
            <pre className="mt-2 p-3 rounded-md bg-muted overflow-x-auto">
{JSON.stringify(result.mp_response, null, 2)}
            </pre>
          </details>
        ) : null}

        <Button variant="outline" onClick={onReset}>
          Rodar de novo
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Item do histórico (expansível)
// ---------------------------------------------------------------------
function LogRowCard({ row }: { row: LogRow }) {
  const [open, setOpen] = useState(false);
  const date = useMemo(
    () => new Date(row.created_at).toLocaleString("pt-BR"),
    [row.created_at],
  );
  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {row.ok ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {date} ·{" "}
              <span className="text-muted-foreground">
                R$ {Number(row.amount).toFixed(2).replace(".", ",")}
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate font-mono">
              {row.payment_id ?? "sem payment_id"} ·{" "}
              {row.status_final ?? row.error ?? "—"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="uppercase text-[10px]">
            {row.ambiente}
          </Badge>
          <Badge variant={row.ok ? "default" : "destructive"}>
            {row.ok ? "OK" : "FALHA"}
          </Badge>
        </div>
      </button>
      {open && (
        <div className="border-t p-3 space-y-3 text-sm">
          {row.error && (
            <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
              <strong>{row.error}</strong>
              {row.message ? ` — ${row.message}` : null}
            </div>
          )}
          <Timeline steps={row.steps ?? []} />
          {row.last_mp_response ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Última resposta sanitizada do MP
              </summary>
              <pre className="mt-2 p-3 rounded-md bg-muted overflow-x-auto">
{JSON.stringify(row.last_mp_response, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------
const STEP_LABELS: Record<string, string> = {
  start: "Início",
  authorize: "Autorizar",
  capture: "Capturar",
  refund: "Estornar",
  get_final: "Consultar status",
};

function isStepOk(s: Step): boolean | undefined {
  if (s.step === "start") return undefined;
  if (typeof s.ok === "boolean") return s.ok;
  if (typeof s.http_status === "number")
    return s.http_status >= 200 && s.http_status < 300;
  return undefined;
}

function Timeline({ steps }: { steps: Step[] }) {
  if (!steps?.length) return null;
  return (
    <ol className="relative border-l border-muted pl-5 space-y-3">
      {steps.map((s, idx) => {
        const ok = isStepOk(s);
        const ts = (() => {
          try {
            return new Date(s.at).toLocaleTimeString("pt-BR", {
              hour12: false,
            });
          } catch {
            return s.at;
          }
        })();
        return (
          <li key={idx} className="relative">
            <span className="absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background">
              {ok === true && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              {ok === false && (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {ok === undefined && (
                <CircleDot className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-medium text-sm">
                {STEP_LABELS[s.step] ?? s.step}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {ts}
              </span>
              {typeof s.http_status === "number" && (
                <Badge variant="outline" className="text-[10px]">
                  HTTP {s.http_status}
                </Badge>
              )}
              {s.mp_status && (
                <Badge variant="secondary" className="text-[10px]">
                  {String(s.mp_status)}
                </Badge>
              )}
              {s.refund_status && (
                <Badge variant="secondary" className="text-[10px]">
                  refund: {String(s.refund_status)}
                </Badge>
              )}
            </div>
            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
              {s.idempotency_key ? (
                <div className="truncate">
                  <span className="not-italic uppercase mr-1">idem:</span>
                  {String(s.idempotency_key)}
                </div>
              ) : null}
              {s.mp_id ? (
                <div className="truncate">
                  <span className="uppercase mr-1">payment:</span>
                  {String(s.mp_id)}
                </div>
              ) : null}
              {s.refund_id ? (
                <div className="truncate">
                  <span className="uppercase mr-1">refund:</span>
                  {String(s.refund_id)}
                </div>
              ) : null}
              {s.mp_status_detail ? (
                <div className="truncate">
                  <span className="uppercase mr-1">detail:</span>
                  {String(s.mp_status_detail)}
                </div>
              ) : null}
              {s.transaction_amount_refunded != null ? (
                <div className="truncate">
                  <span className="uppercase mr-1">refunded amt:</span>
                  {String(s.transaction_amount_refunded)}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------
function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value?: unknown;
  mono?: boolean;
}) {
  const display =
    value === undefined || value === null || value === ""
      ? "—"
      : String(value);
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : "text-sm font-medium"}>
        {display}
      </div>
    </div>
  );
}
