import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Marido pra Quê?" },
      { name: "description", content: "Como protegemos e tratamos seus dados pessoais." },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Política de Privacidade (LGPD)</h1>
      <p className="text-sm text-slate-400 mb-8">Última atualização: [PREENCHER: DATA DA ÚLTIMA ATUALIZAÇÃO]</p>
      <div className="prose prose-slate max-w-none space-y-4 text-slate-600 leading-relaxed">
        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">1. Coleta de Dados Pessoais</h2>
        <p>[PREENCHER: Tipos de dados coletados e métodos de coleta]</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">2. Uso e Tratamento dos Dados</h2>
        <p>[PREENCHER: Finalidade do uso dos dados e base legal para o tratamento]</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">3. Compartilhamento de Informações</h2>
        <p>[PREENCHER: Regras sobre com quem os dados são compartilhados e por quê]</p>
        
        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">4. Segurança dos Dados</h2>
        <p>[PREENCHER: Medidas adotadas para garantir a segurança da informação]</p>
        
        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">5. Seus Direitos (LGPD)</h2>
        <p>[PREENCHER: Direitos do titular e canais de atendimento para exercê-los]</p>
      </div>
    </div>
  );
}
