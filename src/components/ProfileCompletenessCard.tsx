import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Sparkles, ArrowRight } from "lucide-react";

type ChecklistItem = { key: string; label: string; done: boolean };

export function ProfileCompletenessCard() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!user) return;
      const { data: perfil } = await supabase
        .from("profissional_perfil")
        .select("bio, foto_url, especialidades, mp_user_id, cpf, cnpj")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      const list: ChecklistItem[] = [
        { key: "nome", label: "Nome de exibição", done: !!profile?.nome?.trim() },
        { key: "whatsapp", label: "WhatsApp profissional", done: !!profile?.whatsapp?.trim() },
        { key: "foto", label: "Foto de perfil", done: !!perfil?.foto_url },
        { key: "bio", label: "Bio / sobre você", done: !!perfil?.bio?.trim() },
        { key: "cpf", label: "CPF", done: !!perfil?.cpf },
        { key: "cnpj", label: "CNPJ", done: !!perfil?.cnpj },
        { key: "esp", label: "Especialidades", done: (perfil?.especialidades?.length ?? 0) > 0 },
        {
          key: "mp",
          label: "Mercado Pago conectado",
          done: !!(perfil as any)?.mp_user_id,
        },
      ];
      setItems(list);
      setLoaded(true);
    };
    load();
    return () => {
      alive = false;
    };
  }, [user?.id, profile?.nome, profile?.whatsapp]);

  if (!loaded || items.length === 0) return null;

  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  const pending = items.filter((i) => !i.done);

  if (pct === 100) return null;

  const isUrgent = pct < 50;

  return (
    <section
      className={`rounded-3xl border p-6 shadow-sm ${isUrgent ? "bg-amber-50 border-amber-200" : "bg-white border-border"}`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className={`h-12 w-12 rounded-full grid place-items-center ${isUrgent ? "bg-amber-100 text-amber-700" : "bg-brand/10 text-brand"}`}
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Seu perfil está {pct}% completo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isUrgent
                ? "Perfis incompletos recebem menos chamados. Complete agora."
                : `Faltam ${pending.length} ${pending.length === 1 ? "item" : "itens"} para destravar mais visibilidade.`}
            </p>
          </div>
        </div>
        <Link
          to="/profissional"
          search={{ tab: "configuracoes" }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline shrink-0"
        >
          Completar agora <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isUrgent ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-2 text-xs">
            {i.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            )}
            <span
              className={
                i.done ? "text-muted-foreground line-through" : "text-slate-700 font-medium"
              }
            >
              {i.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
