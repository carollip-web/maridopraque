import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | Marido pra Quê?" },
      { name: "description", content: "Termos de Uso da plataforma Marido pra Quê?." },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Termos de Uso</h1>
      <p className="text-sm text-slate-400 mb-8">Última atualização: [PREENCHER: data]</p>
      <div className="max-w-none space-y-4 text-slate-600 leading-relaxed">
        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">1. Quem Somos</h2>
        <p>A plataforma Marido pra Quê? é operada por [PREENCHER: razão social completa], inscrita no CNPJ sob nº [PREENCHER: número do CNPJ], com sede em [PREENCHER: endereço]. Ao longo deste documento, referida como "plataforma", "nós" ou "Marido pra Quê?".</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">2. O Que Fazemos</h2>
        <p>A Marido pra Quê? é uma plataforma digital que conecta clientes a profissionais qualificados para a prestação de serviços domésticos de pequenos reparos, montagens, instalações e serviços relacionados, na região de Copacabana e Ipanema, no Rio de Janeiro. A plataforma atua como intermediadora, facilitando o contato, o orçamento, o agendamento e o pagamento entre cliente e profissional. A execução do serviço é de responsabilidade do profissional contratado.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">3. Cadastro</h2>
        <p>Para solicitar serviços, o cliente deve fornecer informações verdadeiras e completas. O cliente é responsável por manter a confidencialidade de sua senha e por todas as atividades realizadas em sua conta. É proibido criar contas com informações falsas ou em nome de terceiros sem autorização. A plataforma pode recusar, suspender ou cancelar cadastros que violem estes Termos.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">4. Profissionais</h2>
        <p>Os profissionais passam por processo de verificação de documentos antes de serem habilitados. Os profissionais são prestadores autônomos e não possuem vínculo empregatício com a plataforma. A plataforma não se responsabiliza por atos praticados pelos profissionais fora do escopo do serviço contratado, mas oferece mecanismos de avaliação, suporte e garantia para proteger os clientes.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">5. Orçamentos, Pagamentos e Comissão</h2>
        <p>O cliente solicita um orçamento e recebe propostas dos profissionais. O pagamento é realizado pela plataforma, de forma segura, por meio do Mercado Pago, somente após o cliente aceitar a proposta. A plataforma retém uma comissão sobre o valor do serviço a título de intermediação. O cliente só é cobrado após aceitar a proposta do profissional.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">6. Modalidade de Apoio Feminino</h2>
        <p>A plataforma oferece a opção de atendimento com apoio feminino, na qual uma profissional acompanha o atendimento, proporcionando mais segurança e conforto ao cliente. Essa modalidade possui um acréscimo de 30% sobre o valor do serviço, informado de forma clara ao cliente no momento da contratação.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">7. Cancelamento e Reembolso</h2>
        <p>As regras de cancelamento e reembolso estão descritas na Política de Cancelamento e Reembolso, que faz parte integrante destes Termos.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">8. Garantia</h2>
        <p>Os serviços contam com garantia de 30 dias, conforme detalhado na Política de Cancelamento.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">9. Responsabilidades e Limitações</h2>
        <p>A plataforma envida seus melhores esforços para garantir a qualidade dos profissionais, mas não garante resultados específicos de cada serviço. A plataforma não se responsabiliza por danos decorrentes de uso indevido, informações falsas fornecidas pelas partes, ou caso fortuito e força maior. Disputas entre cliente e profissional podem ser mediadas pelo suporte da plataforma.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">10. Conduta do Usuário</h2>
        <p>É proibido usar a plataforma para fins ilícitos, ofensivos, fraudulentos, ou que violem direitos de terceiros. O descumprimento pode resultar em suspensão ou cancelamento da conta.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">11. Alterações nos Termos</h2>
        <p>A plataforma pode atualizar estes Termos a qualquer momento. Mudanças relevantes serão comunicadas aos usuários. O uso continuado após as alterações implica concordância.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">12. Foro</h2>
        <p>Fica eleito o foro da Comarca do [PREENCHER: cidade/estado] para dirimir quaisquer questões oriundas destes Termos.</p>
      </div>
    </div>
  );
}
