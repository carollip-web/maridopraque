import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

function gerarCodigo(nome: string) {
  const base =
    (nome || "PRO")
      .replace(/[^A-Za-zÀ-ú]/g, "")
      .slice(0, 4)
      .toUpperCase() || "PRO";
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function ProfissionalIndicacao({ nome }: { nome: string }) {
  const { user } = useAuth();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [usos, setUsos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("indicacoes")
      .select("codigo, usos")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCodigo(data.codigo);
          setUsos(data.usos ?? 0);
        }
        setLoading(false);
      });
  }, [user?.id]);

  const criar = async () => {
    if (!user) return;
    setCriando(true);
    const novo = gerarCodigo(nome);
    const { data, error } = await supabase
      .from("indicacoes")
      .insert({ user_id: user.id, codigo: novo, desconto_percent: 10 })
      .select("codigo, usos")
      .single();
    setCriando(false);
    if (error) {
      toast.error("Não foi possível gerar o código.");
      return;
    }
    setCodigo(data.codigo);
    setUsos(data.usos ?? 0);
    toast.success("Código de indicação criado!");
  };

  const link = codigo ? `${window.location.origin}/login.profissional?ref=${codigo}` : "";

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center gap-2 mb-2">
        <UserPlus className="h-4 w-4 text-brand" />
        <h3 className="font-bold">Indique outros profissionais</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Convide colegas de confiança. Você ganha bônus a cada profissional aprovado que faz o
        primeiro serviço pela plataforma.
      </p>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-brand" />
      ) : codigo ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-sm font-mono font-bold">
              {codigo}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast.success("Link copiado!");
              }}
              className="rounded-full"
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Indicações realizadas: <strong className="text-foreground">{usos}</strong>
          </p>
        </div>
      ) : (
        <Button
          onClick={criar}
          disabled={criando}
          className="bg-brand text-brand-foreground rounded-full font-bold"
        >
          {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar meu código"}
        </Button>
      )}
    </div>
  );
}
