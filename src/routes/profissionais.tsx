import { createFileRoute, Link } from "@tanstack/react-router";
import { UserRound, Wrench, HeartHandshake, ShieldCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NivelBadge } from "@/components/NivelBadge";

export const Route = createFileRoute("/profissionais")({
  head: () => ({
    meta: [
      { title: "Nossos Profissionais — Mulher, Homem ou com Apoio Feminino" },
      {
        name: "description",
        content:
          "Escolha o tipo de atendimento: profissional mulher, homem ou profissional com apoio feminino durante a visita. Todos verificados e treinados.",
      },
      { property: "og:title", content: "Nossos Profissionais — Marido pra Quê?" },
      {
        property: "og:description",
        content: "Atendimento do jeito que faz sentido pra você, com segurança.",
      },
    ],
  }),
  component: Profissionais,
});

const professionalDetails = [
  {
    id: "mulher",
    title: "Profissional Mulher",
    icon: UserRound,
    description: "Atendimento feito por uma profissional mulher do início ao fim.",
    longDesc:
      "Ideal para mulheres que moram sozinhas, idosas ou qualquer pessoa que prefira a presença feminina para serviços de reparos e montagem. Nossas profissionais são treinadas e equipadas com ferramentas de alta performance para garantir um serviço impecável.",
    benefits: [
      "Máxima tranquilidade e identificação",
      "Cuidado e capricho nos detalhes",
      "Ambiente de total segurança e respeito",
      "Especialista em pequenos reparos e montagens",
    ],
    observation:
      "Prefere atendimento por uma profissional mulher? Sem problema! Vamos verificar a disponibilidade na sua região. Caso não haja, você ainda pode contar com a opção de apoio feminino durante a visita para sua segurança e conforto.",
  },
  {
    id: "homem",
    title: "Profissional Homem",
    icon: Wrench,
    description: "Equipe masculina qualificada, verificada e educada.",
    longDesc:
      "Nossos profissionais homens são selecionados não apenas pela habilidade técnica, mas pelo comportamento exemplar. São especialistas em serviços que exigem maior força física, instalações complexas de TV ou manutenções de engenharia pesada.",
    benefits: [
      "Especialistas em serviços de força e complexidade",
      "Conduta e educação rigorosamente avaliadas",
      "Treinamento técnico para grandes reparos",
      "Equipamentos de proteção e segurança (EPIs)",
    ],
  },
  {
    id: "acompanhante",
    title: "Profissional + Apoio Feminino",
    icon: HeartHandshake,
    description: "Segurança em dobro: o técnico pesado com apoio feminino.",
    longDesc:
      "Nossa modalidade exclusiva e mais escolhida. O técnico realiza o serviço pesado enquanto uma mulher de apoio acompanha todo o processo, auxiliando na organização, limpeza e garantindo que você se sinta 100% confortável e segura dentro da sua própria casa.",
    benefits: [
      "Você nunca fica sozinha com o técnico",
      "Apoio feminino na organização pós-serviço",
      "Protocolo rígido de conduta e discrição",
      "Paz de espírito total para quem mora sozinha",
    ],
    highlight: true,
  },
];

function Profissionais() {
  const [profissionais, setProfissionais] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: pubs } = await supabase
        .from("profissionais_publicos")
        .select("user_id, slug, foto_url, especialidades")
        .eq("ativo", true)
        .eq("aprovacao_status", "aprovado");

      if (!pubs || pubs.length === 0) return;

      const ids = pubs.map((p) => p.user_id);

      const [{ data: profs }, { data: orcs }, { data: avs }] = await Promise.all([
        supabase.from("profiles").select("id, nome").in("id", ids),
        supabase.from("orcamentos").select("profissional_id").in("profissional_id", ids).eq("status", "pago"),
        supabase.from("avaliacoes_publicas").select("profissional_id, nota").in("profissional_id", ids),
      ]);

      const profsMap = Object.fromEntries((profs || []).map((p) => [p.id, p.nome]));
      
      const stats: Record<string, { concluidos: number; notaTotal: number; avaliacoes: number }> = {};
      ids.forEach((id) => {
        if (id) stats[id] = { concluidos: 0, notaTotal: 0, avaliacoes: 0 };
      });

      (orcs || []).forEach((o) => {
        if (o.profissional_id) stats[o.profissional_id].concluidos += 1;
      });

      (avs || []).forEach((a) => {
        if (a.profissional_id) {
          stats[a.profissional_id].notaTotal += a.nota;
          stats[a.profissional_id].avaliacoes += 1;
        }
      });

      const processed = pubs.map((p) => {
        const s = stats[p.user_id!] || { concluidos: 0, notaTotal: 0, avaliacoes: 0 };
        const notaMedia = s.avaliacoes > 0 ? s.notaTotal / s.avaliacoes : 0;
        return {
          ...p,
          nome: profsMap[p.user_id!] || "Profissional",
          concluidos: s.concluidos,
          notaMedia,
        };
      });

      setProfissionais(processed);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Nossa Equipe
        </span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Quem entrará na sua casa?
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Acreditamos que a competência técnica deve vir acompanhada de respeito e segurança. Por
          isso, deixamos você escolher quem te atende.
        </p>
      </div>

      <div className="space-y-24">
        {professionalDetails.map((prof) => (
          <section
            id={prof.id}
            key={prof.title}
            className={
              "relative scroll-mt-32 rounded-[3rem] p-8 md:p-16 border transition " +
              (prof.highlight
                ? "border-brand/20 bg-brand-soft/50 shadow-soft"
                : "border-border bg-card")
            }
          >
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <div
                  className={
                    "flex h-16 w-16 items-center justify-center rounded-2xl mb-8 " +
                    (prof.highlight ? "bg-brand text-brand-foreground" : "bg-muted text-foreground")
                  }
                >
                  <prof.icon className="h-8 w-8" />
                </div>
                {prof.highlight && (
                  <span className="inline-block mb-4 rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-foreground">
                    EXCLUSIVO MARIDO PRA QUÊ?
                  </span>
                )}
                <h2 className="text-4xl font-bold tracking-tight">{prof.title}</h2>
                <p className="mt-6 text-lg text-muted-foreground leading-relaxed italic">
                  "{prof.description}"
                </p>
                <p className="mt-6 text-muted-foreground leading-relaxed">{prof.longDesc}</p>
                {prof.observation && (
                  <p className="mt-6 text-sm font-medium text-brand/80 leading-relaxed">
                    * {prof.observation}
                  </p>
                )}
              </div>

              <div className="rounded-3xl bg-background/50 p-8 border border-border/50">
                <h3 className="text-lg font-bold mb-6">O que esperar deste atendimento:</h3>
                <ul className="space-y-4">
                  {prof.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                      <span className="font-medium">{benefit}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button asChild variant="brand" className="w-full rounded-full">
                    <Link to="/servicos">Solicitar com esta modalidade →</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      {profissionais.length > 0 && (
        <div className="mt-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight">Conheça nossos profissionais</h2>
            <p className="mt-4 text-lg text-muted-foreground">Pessoas reais, verificadas e prontas para te atender.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {profissionais.map((p, i) => (
              <Link key={i} to={`/profissionais/perfil/${p.slug}`} className="block group">
                <div className="rounded-[2rem] border border-border bg-card p-6 transition group-hover:border-brand/30 group-hover:shadow-soft">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-16 w-16 rounded-2xl bg-brand-soft flex items-center justify-center overflow-hidden shrink-0 border border-border">
                      {p.foto_url ? (
                        <img src={p.foto_url} alt={p.nome} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-brand">{p.nome.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg group-hover:text-brand transition-colors">{p.nome}</h3>
                      {p.notaMedia > 0 && (
                        <div className="flex items-center gap-1 text-sm font-medium mt-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {p.notaMedia.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                  {p.especialidades && p.especialidades.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {p.especialidades.slice(0, 3).map((e: string) => (
                        <span key={e} className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                  <NivelBadge concluidos={p.concluidos} notaMedia={p.notaMedia} compact={false} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-32 grid gap-12 md:grid-cols-2 md:items-center">
        <div className="space-y-8">
          <h2 className="text-4xl font-bold tracking-tight">Nosso Selo de Verificação</h2>
          <p className="text-lg text-muted-foreground">
            A segurança não é opcional. Todo profissional que veste nossa camisa passa por um funil
            de seleção com verificação rigorosa de documentos, identidade e competência técnica.
          </p>
          <div className="grid gap-6">
            {[
              {
                t: "Identidade Validada",
                d: "Documentação completa e comprovante de residência verificados.",
              },
              {
                t: "Conduta Avaliada",
                d: "Profissionais monitorados por avaliações dos clientes após cada serviço.",
              },
              {
                t: "Referência Técnica",
                d: "Prova de competência e checagem de serviços anteriores.",
              },
            ].map((item) => (
              <div key={item.t} className="flex gap-4">
                <div className="h-2 w-2 rounded-full bg-brand mt-2" />
                <div>
                  <h4 className="font-bold">{item.t}</h4>
                  <p className="text-sm text-muted-foreground">{item.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative aspect-square rounded-[3rem] bg-cream flex items-center justify-center p-12 text-center overflow-hidden">
          <Star
            className="absolute -right-10 -top-10 h-40 w-40 text-brand/10 rotate-12"
            fill="currentColor"
          />
          <div className="relative z-10">
            <Star className="h-12 w-12 text-brand mx-auto mb-6" fill="currentColor" />
            <blockquote className="text-2xl font-medium leading-tight">
              "Não é apenas sobre consertar uma torneira, é sobre poder abrir a porta de casa sem
              medo."
            </blockquote>
            <p className="mt-6 font-bold text-brand uppercase tracking-wider text-sm">
              Missão Marido pra Quê?
            </p>
          </div>
        </div>
      </div>

      <div className="mt-32 rounded-[3rem] bg-brand p-12 md:p-20 text-center text-brand-foreground shadow-brand relative overflow-hidden">
        <Star className="absolute -left-10 -bottom-10 h-64 w-64 text-black/5 rotate-12" fill="currentColor" />
        <div className="relative z-10">
          <h2 className="text-4xl font-bold md:text-5xl">Pronta pra resolver?</h2>
          <p className="mt-6 text-lg text-brand-foreground/90 max-w-xl mx-auto">
            Solicite um orçamento agora pela plataforma.
          </p>
          <Button asChild variant="secondary" size="lg" className="mt-10 rounded-full h-14 px-10 text-brand bg-white hover:bg-white/90 font-bold text-lg">
            <Link to="/servicos">Pedir orçamento →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
