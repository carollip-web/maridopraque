import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/mp/callback")({
  component: MpCallbackPage,
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
});

function MpCallbackPage() {
  const navigate = useNavigate();
  const { code, state, error } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando ao Mercado Pago...");
  const calledRef = useRef(false);

  useEffect(() => {
    // Guard: authorization code is single-use, never call twice
    if (calledRef.current) return;
    calledRef.current = true;

    const processCallback = async () => {
      if (error) {
        setStatus("error");
        setMessage(`Mercado Pago retornou erro: ${error}`);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Parâmetros de callback ausentes (code ou state)");
        return;
      }

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("mercado-pago-oauth-callback", {
          body: { code, state },
        });

        if (invokeError) {
          // Extract actual error body from FunctionsHttpError
          let errorMsg = invokeError.message;
          if (invokeError.context) {
            try {
              const parsed = await invokeError.context.json();
              errorMsg = parsed.error || JSON.stringify(parsed);
              console.error("[mp-callback] Edge Function error body:", parsed);
            } catch {
              // context might not be JSON
            }
          }
          throw new Error(errorMsg);
        }
        if (!data?.ok) throw new Error(data?.error ?? "Falha desconhecida");

        setStatus("success");
        setMessage("Conta Mercado Pago conectada com sucesso! Redirecionando...");

        setTimeout(() => {
          navigate({ to: "/profissional" });
        }, 2000);
      } catch (err: any) {
        console.error("[mp-callback]", err);
        setStatus("error");
        setMessage(err?.message ?? "Falha ao conectar conta Mercado Pago");
      }
    };

    processCallback();
  }, [code, state, error, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Conectando ao Mercado Pago</h2>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
            <h2 className="text-xl font-semibold text-green-700">Sucesso!</h2>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold text-destructive">Erro na conexão</h2>
          </>
        )}
        <p className="text-muted-foreground">{message}</p>
        {status === "error" && (
          <button
            onClick={() => navigate({ to: "/profissional" })}
            className="text-sm text-primary hover:underline"
          >
            Voltar ao painel do profissional
          </button>
        )}
      </Card>
    </div>
  );
}
