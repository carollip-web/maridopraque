import { createFileRoute, Link } from "@tanstack/react-router";
import { FileCheck2 } from "lucide-react";

export const TERMO_VERSAO = "1.0";

export const Route = createFileRoute("/termo-adesao")({
  head: () => ({
    meta: [
      { title: `Termo de Adesão e Responsabilidade | Marido pra Quê?` },
      {
        name: "description",
        content:
          "Termo de Adesão e Responsabilidade para prestadores de serviços da plataforma Marido pra Quê?.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-full bg-brand/10 text-brand grid place-items-center">
          <FileCheck2 className="h-5 w-5" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">
          Termo de Adesão e Responsabilidade
        </h1>
      </div>
      <p className="text-sm text-slate-400 mb-8">
        Versão {TERMO_VERSAO} — Leia atentamente antes de se cadastrar como prestador.
      </p>

      <div className="max-w-none space-y-4 text-slate-600 leading-relaxed">
        <p>
          <strong className="text-slate-800">1. Autonomia.</strong> Atuo como prestador autônomo,
          sem vínculo empregatício com a plataforma. Sou responsável pelos meus tributos, INSS e
          demais obrigações fiscais.
        </p>
        <p>
          <strong className="text-slate-800">2. Capacitação.</strong> Possuo conhecimento técnico,
          ferramentas e EPIs adequados para os serviços que aceitar.
        </p>
        <p>
          <strong className="text-slate-800">3. Responsabilidade integral.</strong> Sou inteira e
          exclusivamente responsável pela execução, qualidade, segurança e eventuais danos causados
          durante o serviço, isentando a plataforma de qualquer reparação a terceiros.
        </p>
        <p>
          <strong className="text-slate-800">4. Conduta.</strong> Comprometo-me com pontualidade,
          respeito, honestidade e sigilo das informações do cliente.
        </p>
        <p>
          <strong className="text-slate-800">5. Preço e pagamento.</strong> Aceito a tabela vigente da
          plataforma e o repasse na forma e prazos divulgados.
        </p>
        <p>
          <strong className="text-slate-800">6. Cancelamento.</strong> Posso recusar serviços, mas o
          cancelamento após aceite injustificado pode gerar penalidades.
        </p>
        <p>
          <strong className="text-slate-800">7. Dados.</strong> Autorizo o uso de meus dados de perfil,
          avaliações e histórico conforme LGPD.
        </p>
        <p>
          <strong className="text-slate-800">8. Validade.</strong> Este termo permanece válido enquanto
          eu mantiver cadastro ativo. Atualizações exigirão novo aceite.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link
          to="/login/profissional"
          className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-brand-foreground shadow-brand transition hover:-translate-y-0.5"
        >
          Quero me cadastrar
        </Link>
        <Link
          to="/termos"
          className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-7 text-sm font-medium text-foreground transition hover:bg-brand-soft"
        >
          Ver Termos de Uso
        </Link>
      </div>
    </div>
  );
}
