import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/mp-teste")({
  component: MpTestePage,
  head: () => ({ meta: [{ title: "MP Smoke Test · Admin" }] }),
});

type SmokeResult = {
  ok: boolean;
  ambiente?: string;
  payment_id?: string;
  summary?: Record<string, unknown>;
  steps?: Array<Record<string, unknown>>;
  error?: string;
  message?: string;
  mp_response?: unknown;
};

const AMOUNT = 1.0;

function MpTestePage() {
  const { isLoggedIn, isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "brick" | "running" | "done">("idle");
  const [result, setResult] = useState<SmokeResult | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const brickMountedRef = useRef(false);
  const brickControllerRef = useRef<any>(null);

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn || !isAdmin) navigate({ to: "/login" });
  }, [loading, isLoggedIn, isAdmin, navigate]);

  const startTest = async () => {
    setErrMsg(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("mp-get-public-key");
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

  // Monta o Brick
  useEffect(() => {
    if (phase !== "brick" || !publicKey || brickMountedRef.current) return;
    let cancelled = false;

    async function ensureSdk() {
      if ((window as any).MercadoPago) return (window as any).MercadoPago;
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-mp-sdk="v2"]');
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("SDK MP")));
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
                    {
                      body: { card_token: formData.token, amount: AMOUNT },
                    },
                  );
                  if (error) throw error;
                  setResult(data as SmokeResult);
                  setPhase("done");
                  if ((data as SmokeResult)?.ok) {
                    toast.success("Smoke test concluído com sucesso");
                  } else {
                    toast.error("Smoke test falhou — veja detalhes abaixo");
                  }
                } catch (e: any) {
                  setErrMsg(e?.message || "Falha ao executar smoke test");
                  setPhase("done");
                }
              },
            },
          },
        );
      } catch (e: any) {
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
  }, [phase, publicKey, user?.email]);

  const reset = () => {
    setResult(null);
    setErrMsg(null);
    setPhase("idle");
    setPublicKey(null);
  };

  if (loading) return null;

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Mercado Pago · Smoke Test</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Cobra <strong>R$ {AMOUNT.toFixed(2).replace(".", ",")}</strong> em um cartão real,
          executa <em>autorizar → capturar → estornar</em> e mostra o status de cada etapa.
          O estorno é automático ao final. Não cria pedido nem mexe em pagamentos do sistema.
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
                Este teste roda no <strong>ambiente atual do MP</strong>
                {" "}(definido pelo secret <code>MP_AMBIENTE</code>).
                Em produção, R$ 1,00 será cobrado de verdade e estornado em seguida.
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
              {phase === "running" ? "Executando smoke test…" : "Tokenize o cartão"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div id="mp-smoke-brick" />
            {phase === "running" && (
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Autorizando, capturando e estornando R$ {AMOUNT.toFixed(2).replace(".", ",")}…
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {errMsg && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{errMsg}</CardContent>
        </Card>
      )}

      {phase === "done" && result && (
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
            <div className="grid grid-cols-2 gap-2">
              <Info label="Ambiente" value={result.ambiente} />
              <Info label="Payment ID" value={result.payment_id} mono />
              <Info label="Autorizado" value={(result.summary as any)?.autorizado} />
              <Info label="Capturado" value={(result.summary as any)?.capturado} />
              <Info label="Estornado" value={String((result.summary as any)?.estornado ?? "-")} />
              <Info label="Status final" value={(result.summary as any)?.status_final} />
            </div>

            {result.error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-xs">
                <div className="font-semibold">{result.error}</div>
                {result.message && <div>{result.message}</div>}
              </div>
            )}

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Etapas detalhadas (JSON)
              </summary>
              <pre className="mt-2 p-3 rounded-md bg-muted overflow-x-auto">
{JSON.stringify(result.steps ?? [], null, 2)}
              </pre>
            </details>

            {result.mp_response ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Última resposta do MP
                </summary>
                <pre className="mt-2 p-3 rounded-md bg-muted overflow-x-auto">
{JSON.stringify(result.mp_response, null, 2)}
                </pre>
              </details>
            ) : null}

            <Button variant="outline" onClick={reset}>
              Rodar de novo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

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
    value === undefined || value === null || value === "" ? "—" : String(value);
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs" : "text-sm font-medium"}>
        {display}
      </div>
    </div>
  );
}
