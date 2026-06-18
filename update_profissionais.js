const fs = require('fs');
const content = fs.readFileSync('src/routes/profissionais.tsx', 'utf-8');

let newContent = content.replace(
  'import { createFileRoute } from "@tanstack/react-router";\nimport { UserRound, Wrench, HeartHandshake, ShieldCheck, Star } from "lucide-react";',
  `import { createFileRoute, Link } from "@tanstack/react-router";
import { UserRound, Wrench, HeartHandshake, ShieldCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NivelBadge } from "@/components/NivelBadge";`
);

newContent = newContent.replace(
  'Sem Antecedentes — Certidões negativas criminais atualizadas periodicamente',
  'Conduta Avaliada — Profissionais monitorados por avaliações dos clientes após cada serviço'
);

newContent = newContent.replace(
  'exclui 90% dos candidatos',
  'com verificação rigorosa de documentos, identidade e competência técnica'
);

newContent = newContent.replace(
  'Modalidade Mais Escolhida',
  'EXCLUSIVO MARIDO PRA QUÊ?'
);

newContent = newContent.replace(
  /<ShieldCheck className="mt-0\.5 h-5 w-5 shrink-0 text-brand" \/>\s*<span className="font-medium">{benefit}<\/span>\s*<\/li>\s*))\s*<\/ul>\s*<\/div>/g,
  `<ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                      <span className="font-medium">{benefit}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button asChild variant="brand" className="w-full rounded-full">
                    <Link to="/servicos">Solicitar com esta modalidade →</Link>
                  </Button>
                </div>
              </div>`
);

newContent = newContent.replace(
  'function Profissionais() {\n  return (',
  `function Profissionais() {
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

  return (`
);

const profissionaisSection = `
      <div className="mt-32 grid gap-12 md:grid-cols-2 md:items-center">
        <div className="space-y-8">`;

const profSectionCode = `
      {profissionais.length > 0 && (
        <div className="mt-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight">Conheça nossos profissionais</h2>
            <p className="mt-4 text-lg text-muted-foreground">Pessoas reais, verificadas e prontas para te atender.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {profissionais.map((p, i) => (
              <Link key={i} to={\`/profissionais/perfil/\${p.slug}\`} className="block group">
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
        <div className="space-y-8">`;

newContent = newContent.replace(profissionaisSection, profSectionCode);

const preFooterSection = `
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
`;

newContent = newContent.replace('    </div>\n  );\n}', preFooterSection);

fs.writeFileSync('src/routes/profissionais.tsx', newContent);
console.log('Update complete');
