import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, ShieldCheck, MapPin, ArrowLeft, MessageCircle, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useFavoritoProfissional } from "@/hooks/useFavoritoProfissional";

type PerfilSEO = {
  user_id: string;
  nome: string;
  bio: string | null;
  foto_url: string | null;
  cidade: string | null;
  especialidades: string[] | null;
} | null;

export const Route = createFileRoute("/profissionais/perfil/$slug")({
  loader: async ({ params }): Promise<{ seo: PerfilSEO }> => {
    const { data: p } = await supabase
      .from("profissionais_publicos" as any)
      .select("user_id, bio, foto_url, cidade, especialidades")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!p) return { seo: null };
    const pub = p as unknown as {
      user_id: string;
      bio: string | null;
      foto_url: string | null;
      cidade: string | null;
      especialidades: string[] | null;
    };
    const { data: prof } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", pub.user_id)
      .maybeSingle();
    return {
      seo: {
        user_id: pub.user_id,
        nome: prof?.nome || "Profissional verificado",
        bio: pub.bio,
        foto_url: pub.foto_url,
        cidade: pub.cidade,
        especialidades: pub.especialidades,
      },
    };
  },
  head: ({ params, loaderData }) => {
    const seo = loaderData?.seo;
    if (!seo) {
      return {
        meta: [
          { title: "Perfil não encontrado — Marido pra Quê?" },
          { name: "description", content: "Esse profissional pode ter saído da plataforma." },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const especs = (seo.especialidades || []).slice(0, 4).join(", ");
    const cidade = seo.cidade ? ` em ${seo.cidade}` : "";
    const title = `${seo.nome}${cidade} — Marido pra Quê?`;
    const description =
      (seo.bio && seo.bio.trim().slice(0, 155)) ||
      `${seo.nome} é profissional verificado Marido pra Quê?${cidade}${
        especs ? `. Especialidades: ${especs}` : ""
      }. Veja avaliações reais e solicite um orçamento.`;
    const canonical = `https://www.maridopraque.com/profissionais/perfil/${params.slug}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: canonical },
    ];
    if (seo.foto_url) {
      meta.push({ property: "og:image", content: seo.foto_url });
      meta.push({ name: "twitter:image", content: seo.foto_url });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: seo.nome,
            description,
            ...(seo.foto_url ? { image: seo.foto_url } : {}),
            ...(seo.cidade
              ? { address: { "@type": "PostalAddress", addressLocality: seo.cidade } }
              : {}),
            ...(especs ? { knowsAbout: especs.split(", ") } : {}),
            url: canonical,
          }),
        },
      ],
    };
  },
  component: PerfilProfissional,
});

export type ProfissionalPublico = {
  user_id: string;
  slug: string | null;
  bio: string | null;
  especialidades: string[] | null;
  foto_url: string | null;
  cidade: string | null;
  ativo: boolean;
  aprovacao_status: string;
  lat: number | null;
  lng: number | null;
  raio_atendimento_km: number;
  oferece_apoio_feminino: boolean;
  anos_experiencia: number | null;
  experiencia_anos: number | null;
  atende_emergencias: boolean | null;
  veiculo_proprio: boolean | null;
  duracao_padrao_min: number;
  genero: string | null;
  created_at: string;
};

type Perfil = {
  user_id: string;
  slug: string | null;
  bio: string | null;
  especialidades: string[] | null;
  foto_url: string | null;
  cidade: string | null;
  profiles?: { nome: string } | null;
};

type Avaliacao = {
  id: string;
  nota: number;
  comentario: string | null;
  created_at: string;
  resposta_profissional: string | null;
  resposta_em: string | null;
};

function PerfilProfissional() {
  const { slug } = Route.useParams();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nome, setNome] = useState<string>("Profissional");
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: p } = (await supabase
        .from("profissionais_publicos" as any)
        .select("*")
        .eq("slug", slug)
        .maybeSingle()) as { data: ProfissionalPublico | null };
      if (p) {
        setPerfil(p as Perfil);
        const { data: prof } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", p.user_id)
          .maybeSingle();
        if (prof?.nome) setNome(prof.nome);
        const { data: avs } = await supabase
          .from("avaliacoes")
          .select("id, nota, comentario, created_at, resposta_profissional, resposta_em")
          .eq("profissional_id", p.user_id)
          .order("created_at", { ascending: false })
          .limit(20);
        setAvaliacoes((avs as Avaliacao[]) || []);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center text-muted-foreground">
        Carregando perfil…
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-3xl font-bold">Perfil não encontrado</h1>
        <p className="mt-3 text-muted-foreground">
          Esse profissional pode ter saído da plataforma.
        </p>
        <Button asChild className="mt-8 rounded-full bg-brand text-brand-foreground px-8 h-12">
          <Link to="/profissionais">Ver todos os tipos de atendimento</Link>
        </Button>
      </div>
    );
  }

  const media =
    avaliacoes.length > 0
      ? (avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length).toFixed(1)
      : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Link
        to="/profissionais"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand mb-8"
      >
        <ArrowLeft className="h-4 w-4" /> Todos os profissionais
      </Link>

      <header className="rounded-[2.5rem] border border-border bg-card p-8 md:p-12 shadow-soft">
        <div className="flex flex-col md:flex-row gap-8 md:items-center">
          <div className="h-32 w-32 rounded-3xl bg-brand-soft border border-border flex items-center justify-center overflow-hidden shrink-0">
            {perfil.foto_url ? (
              <img src={perfil.foto_url} alt={nome} className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-brand">{nome.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-brand">
              <ShieldCheck className="h-3.5 w-3.5" /> Profissional verificado
            </span>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">{nome}</h1>
            {perfil.cidade && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {perfil.cidade}
              </p>
            )}
            {media && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-100 px-4 py-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-bold">{media}</span>
                <span className="text-xs text-muted-foreground">
                  ({avaliacoes.length} avaliações)
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FavoritoButton profissionalId={perfil.user_id} />
            <Button
              asChild
              className="rounded-full bg-brand text-brand-foreground h-12 px-8 font-bold"
            >
              <Link to="/servicos">Pedir orçamento</Link>
            </Button>
          </div>
        </div>

        {perfil.bio && (
          <p className="mt-8 text-lg text-muted-foreground leading-relaxed">{perfil.bio}</p>
        )}

        {perfil.especialidades && perfil.especialidades.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {perfil.especialidades.map((e) => (
              <span
                key={e}
                className="rounded-full bg-muted px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
              >
                {e}
              </span>
            ))}
          </div>
        )}
      </header>

      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Avaliações de clientes</h2>
        {avaliacoes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-50" />
            Ainda sem avaliações. Seja a primeira pessoa a contratar.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {avaliacoes.map((a) => (
              <article key={a.id} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < a.nota ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                {a.comentario && <p className="text-sm leading-relaxed">{a.comentario}</p>}
                <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </p>
                {a.resposta_profissional && (
                  <div className="mt-4 p-3 rounded-xl bg-muted/40 border-l-4 border-brand">
                    <p className="text-[10px] uppercase tracking-widest text-brand font-bold mb-1">
                      Resposta de {nome}
                    </p>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {a.resposta_profissional}
                    </p>
                    {a.resposta_em && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(a.resposta_em).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
