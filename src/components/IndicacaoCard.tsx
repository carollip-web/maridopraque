import { useEffect, useState } from "react";
import { Gift, Copy, Check, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function gerarCodigo(nome: string) {
  const base = (nome || "amigo").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "AMIGO";
  const suf = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suf}`;
}

export function IndicacaoCard() {
  const { user } = useAuth();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [usos, setUsos] = useState<number>(0);
  const [desconto, setDesconto] = useState<number>(10);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("indicacoes")
        .select("codigo, usos, desconto_percent")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setCodigo(data.codigo);
        setUsos(data.usos);
        setDesconto(data.desconto_percent);
      }
      setLoading(false);
    })();
  }, [user]);

  const criarCodigo = async () => {
    if (!user) return;
    const nome = (user.user_metadata?.nome as string) || user.email?.split("@")[0] || "AMIGO";
    const novo = gerarCodigo(nome);
    const { error } = await supabase.from("indicacoes").insert({ user_id: user.id, codigo: novo });
    if (error) {
      toast.error("Não foi possível gerar seu código");
      return;
    }
    setCodigo(novo);
    toast.success("Seu código de indicação está pronto!");
  };

  const copiar = async () => {
    if (!codigo) return;
    await navigator.clipboard.writeText(codigo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const compartilhar = async () => {
    if (!codigo) return;
    const texto = `Use meu código ${codigo} no Marido pra Quê? e ganhe ${desconto}% de desconto no primeiro serviço!`;
    if (navigator.share) {
      try { await navigator.share({ text: texto }); } catch {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
    }
  };

  return (
    <section className="bg-gradient-to-br from-brand to-brand/80 text-brand-foreground rounded-[2rem] p-8 shadow-soft relative overflow-hidden">
      <Gift className="absolute -right-6 -bottom-6 h-40 w-40 text-white/10" />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">Programa de Indicação</p>
        <h3 className="mt-2 text-2xl font-bold">Indique e ganhe</h3>
        <p className="mt-2 text-sm opacity-90 leading-relaxed max-w-md">
          Cada amigo que contratar com seu código ganha <strong>{desconto}%</strong> de desconto e você acumula créditos.
        </p>

        {loading ? null : codigo ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur rounded-xl p-3 border border-white/20">
              <code className="flex-1 font-mono font-bold tracking-widest text-lg">{codigo}</code>
              <button onClick={copiar} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Copiar">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={compartilhar} size="sm" className="rounded-full bg-white text-brand hover:bg-white/90 font-bold h-9 px-5">
                <Share2 className="h-3.5 w-3.5 mr-1.5" /> Compartilhar
              </Button>
              <span className="text-xs opacity-80">{usos} {usos === 1 ? "indicação usada" : "indicações usadas"}</span>
            </div>
          </div>
        ) : (
          <Button onClick={criarCodigo} size="sm" className="mt-6 rounded-full bg-white text-brand hover:bg-white/90 font-bold h-10 px-6">
            Gerar meu código
          </Button>
        )}
      </div>
    </section>
  );
}
