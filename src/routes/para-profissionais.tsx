import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Briefcase,
  TrendingUp,
  Wallet,
  Star,
  CheckCircle2,
  ArrowRight,
  Megaphone,
  ShieldCheck,
  Clock,
  Users,
  Zap,
  BellRing,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/para-profissionais")({
  head: () => ({
    meta: [
      { title: "Para Profissionais — Marido pra Quê?" },
      {
        name: "description",
        content:
          "Receba pedidos qualificados, gerencie sua agenda e aumente sua renda. Plataforma feita para o profissional autônomo de reparos e obras.",
      },
      { property: "og:title", content: "Trabalhe com a gente — Marido pra Quê?" },
      {
        property: "og:description",
        content: "Mais clientes, menos esforço. Cadastre-se e comece a receber chamados na sua região.",
      },
    ],
  }),
  component: ParaProfissionaisPage,
});

type DashStats = {
  pendentes: number;
  ganhosMes: number;
  ativo: boolean;
  notaMedia: number | null;
};

function ParaProfissionaisPage() {
  const { isLoggedIn, isProfissional, userData } = useAuth();
  const [stats, setStats] = useState<DashStats | null>(null);

  useEffect(() => {
    if (!isProfissional) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [{ data: pend }, { data: pagos }, { data: perfil }, { data: avals }] = await Promise.all([
        supabase
          .from("orcamentos")
          .select("id", { count: "exact", head: false })
          .is("profissional_id", null)
          .eq("status", "customizado_pendente"),
        supabase
          .from("orcamentos")
          .select("valor_servico, data_pagamento")
          .eq("profissional_id", uid)
          .gte("data_pagamento", inicioMes.toISOString()),
        supabase.from("profissional_perfil").select("ativo").eq("user_id", uid).maybeSingle(),
        supabase.from("avaliacoes").select("nota").eq("profissional_id", uid),
      ]);

      const ganhos = (pagos ?? []).reduce((s, o: any) => s + Number(o.valor_servico ?? 0), 0);
      const notas = (avals ?? []).map((a: any) => Number(a.nota)).filter((n) => !isNaN(n));
      const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

      setStats({
        pendentes: pend?.length ?? 0,
        ganhosMes: ganhos,
        ativo: perfil?.ativo ?? false,
        notaMedia: media,
      });
    })();
  }, [isProfissional]);

  return (
    <div className="bg-background">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-brand/30" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur">
              <Briefcase className="h-3.5 w-3.5" /> Para profissionais
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Mais chamados, menos prospecção.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/80 md:text-lg">
              Receba pedidos qualificados na sua região, gerencie sua agenda e o pagamento cai direto na sua conta.
              Sem mensalidade — você só paga uma comissão por serviço concluído.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isProfissional ? (
                <Button asChild size="lg" className="rounded-full bg-brand text-brand-foreground font-bold shadow-brand h-12 px-8">
                  <Link to="/profissional">
                    Abrir meu painel <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="rounded-full bg-brand text-brand-foreground font-bold shadow-brand h-12 px-8">
                    <Link to="/login/profissional">
                      Quero me cadastrar <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white h-12 px-8">
                    <Link to="/login/profissional">Já sou profissional</Link>
                  </Button>
                </>
              )}
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 text-white/90">
              <div>
                <div className="text-2xl font-bold">+1.200</div>
                <div className="text-xs uppercase tracking-wider text-white/60">Chamados/mês</div>
              </div>
              <div>
                <div className="text-2xl font-bold">4,8★</div>
                <div className="text-xs uppercase tracking-wider text-white/60">Nota média</div>
              </div>
              <div>
                <div className="text-2xl font-bold">48h</div>
                <div className="text-xs uppercase tracking-wider text-white/60">Pagamento</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD SHORTCUTS (logado como profissional) */}
      {isProfissional && (
        <section className="border-b border-border bg-brand/5">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Olá, {userData?.name?.split(" ")[0] || "profissional"} 👋
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Atalhos rápidos do seu painel</p>
              </div>
              <Link to="/profissional" className="text-sm font-bold text-brand hover:underline inline-flex items-center gap-1">
                Ver painel completo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ShortcutCard
                icon={<ListChecks className="h-5 w-5" />}
                label="Pedidos pendentes"
                value={stats ? String(stats.pendentes) : "—"}
                to="/profissional"
              />
              <ShortcutCard
                icon={<Wallet className="h-5 w-5" />}
                label="Ganhos do mês"
                value={stats ? `R$ ${stats.ganhosMes.toFixed(2)}` : "—"}
                to="/profissional"
              />
              <ShortcutCard
                icon={<Star className="h-5 w-5" />}
                label="Avaliação média"
                value={stats?.notaMedia != null ? `${stats.notaMedia.toFixed(1)}★` : "—"}
                to="/profissional"
              />
              <ShortcutCard
                icon={<ShieldCheck className="h-5 w-5" />}
                label="Status do perfil"
                value={stats ? (stats.ativo ? "Ativo" : "Inativo") : "—"}
                to="/profissional"
                tone={stats?.ativo ? "success" : "warning"}
              />
            </div>
          </div>
        </section>
      )}

      {/* BENEFÍCIOS */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Por que entrar</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Tudo o que você precisa para crescer.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Benefit
              icon={<TrendingUp className="h-5 w-5" />}
              title="Demanda constante"
              desc="Mais de 1.200 chamados por mês na nossa base. Receba os que combinam com sua especialidade e raio."
            />
            <Benefit
              icon={<Zap className="h-5 w-5" />}
              title="Sem mensalidade"
              desc="Você só paga comissão sobre serviços concluídos e aprovados pelo cliente. Zero risco."
            />
            <Benefit
              icon={<Wallet className="h-5 w-5" />}
              title="Pagamento em 48h"
              desc="O cliente paga pela plataforma e o valor cai na sua conta em até 2 dias úteis."
            />
            <Benefit
              icon={<Clock className="h-5 w-5" />}
              title="Você define a agenda"
              desc="Aceite só os horários que cabem na sua rotina. Sem multa, sem pressão."
            />
            <Benefit
              icon={<Users className="h-5 w-5" />}
              title="Reputação que vale"
              desc="Avaliações reais de clientes ajudam você a fechar mais serviços por preço justo."
            />
            <Benefit
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Suporte humano"
              desc="Dúvidas, problemas com cliente ou pagamento? Falamos com você por WhatsApp."
            />
          </div>
        </div>
      </section>

      {/* RECADOS / AVISOS */}
      <section className="border-b border-border bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex items-center gap-2 mb-8">
            <Megaphone className="h-5 w-5 text-brand" />
            <h2 className="text-2xl font-semibold tracking-tight">Recados da plataforma</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Aviso
              tag="Novidade"
              titulo="Pagamento agora em 48h"
              desc="Reduzimos o prazo de repasse. Serviços concluídos antes de quinta caem na sua conta na sexta."
              data="Há 3 dias"
            />
            <Aviso
              tag="Treinamento"
              titulo="Como aumentar sua nota média"
              desc="Vídeo de 6 minutos com dicas práticas dos profissionais 5★ da plataforma."
              data="Esta semana"
            />
            <Aviso
              tag="Importante"
              titulo="Atualize seu raio de atendimento"
              desc="Profissionais com raio definido recebem 3x mais chamados. Edite no seu perfil."
              data="Há 1 semana"
            />
            <Aviso
              tag="Comunidade"
              titulo="Indique e ganhe R$ 50"
              desc="A cada profissional indicado que concluir 3 serviços, você ganha R$ 50 de bônus."
              data="Há 2 semanas"
            />
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Como funciona</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Comece em 3 passos.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Step n="1" title="Cadastre-se" desc="Crie sua conta de profissional, envie seus documentos e defina suas especialidades." />
            <Step n="2" title="Receba chamados" desc="Notificações em tempo real com todos os detalhes do serviço e endereço aproximado." />
            <Step n="3" title="Trabalhe e receba" desc="Conclua o serviço, o cliente aprova e o dinheiro cai na sua conta em 48h." />
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand/30 text-white">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <BellRing className="h-10 w-10 mx-auto text-brand mb-4" />
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Pronto para receber seu primeiro chamado?
          </h2>
          <p className="mt-4 text-white/80 max-w-xl mx-auto">
            Cadastro gratuito em menos de 5 minutos. Sem fidelidade, sem mensalidade.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            {isProfissional ? (
              <Button asChild size="lg" className="rounded-full bg-brand text-brand-foreground font-bold h-12 px-8 shadow-brand">
                <Link to="/profissional">
                  Ir para meu painel <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="rounded-full bg-brand text-brand-foreground font-bold h-12 px-8 shadow-brand">
                <Link to="/login/profissional">
                  Quero me cadastrar <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ShortcutCard({
  icon,
  label,
  value,
  to,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  to: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600"
      : tone === "warning"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
        <span className="text-brand">{icon}</span> {label}
      </div>
      <div className={`mt-3 text-2xl font-bold ${toneCls}`}>{value}</div>
    </Link>
  );
}

function Benefit({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">{icon}</div>
      <h3 className="mt-4 font-semibold text-lg">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Aviso({ tag, titulo, desc, data }: { tag: string; titulo: string; desc: string; data: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
          {tag}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{data}</span>
      </div>
      <h3 className="mt-3 font-semibold">{titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-brand-foreground font-bold">
        {n}
      </div>
      <h3 className="mt-4 font-semibold text-lg">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
