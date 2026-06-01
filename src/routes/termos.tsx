import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | Marido pra Quê?" },
      { name: "description", content: "Termos de uso da plataforma Marido pra Quê?" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Termos de Uso</h1>
      <p className="text-sm text-slate-400 mb-8">Última atualização: [PREENCHER: DATA DA ÚLTIMA ATUALIZAÇÃO]</p>
      <div className="prose prose-slate max-w-none space-y-4 text-slate-600 leading-relaxed">
        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">1. Aceitação dos Termos</h2>
        <p>[PREENCHER: Declaração de aceite e concordância com os termos]</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">2. Serviços Prestados</h2>
        <p>[PREENCHER: Descrição dos serviços de intermediação oferecidos pela plataforma]</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">3. Responsabilidades do Cliente</h2>
        <p>[PREENCHER: Obrigações do contratante na plataforma]</p>
        
        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">4. Responsabilidades do Profissional</h2>
        <p>[PREENCHER: Obrigações dos prestadores de serviço]</p>
        
        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">5. Limitações de Responsabilidade</h2>
        <p>[PREENCHER: Limitações legais e isenções da plataforma]</p>
      </div>
    </div>
  );
}
