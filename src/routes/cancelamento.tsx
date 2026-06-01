import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cancelamento")({
  head: () => ({
    meta: [
      { title: "Política de Cancelamento e Reembolso | Marido pra Quê?" },
      { name: "description", content: "Regras de cancelamento, reembolso e garantia dos serviços da Marido pra Quê?." },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Política de Cancelamento e Reembolso</h1>
      <p className="text-sm text-slate-400 mb-8">Última atualização: [PREENCHER: data]</p>
      <div className="max-w-none space-y-4 text-slate-600 leading-relaxed">
        <p>Esta Política de Cancelamento faz parte dos Termos de Uso da plataforma Marido pra Quê? e estabelece as regras para cancelamento de serviços e reembolsos.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">1. Cancelamento pelo Cliente</h2>
        <p>O cliente pode cancelar um serviço já pago, sem qualquer custo, desde que o faça com no mínimo 12 (doze) horas de antecedência em relação ao horário agendado para o atendimento.</p>
        <p>Cancelamentos com 12 horas ou mais de antecedência recebem reembolso integral, processado automaticamente no cartão utilizado, via Mercado Pago. Cancelamentos com menos de 12 horas de antecedência poderão estar sujeitos à retenção de valores, conforme avaliação do suporte, para cobrir custos operacionais e o deslocamento já programado do profissional.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">2. Cancelamento pelo Profissional</h2>
        <p>O profissional pode cancelar um serviço agendado desde que o faça com no mínimo 12 (doze) horas de antecedência. Nesse caso, o cliente recebe reembolso integral, processado automaticamente no cartão via Mercado Pago. A plataforma poderá oferecer a realocação do serviço com outro profissional disponível. Cancelamentos recorrentes por parte de um profissional poderão resultar em advertência ou suspensão do cadastro.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">3. Serviço Não Realizado ou Profissional Ausente</h2>
        <p>Caso o profissional não compareça ao atendimento agendado, ou o serviço não seja realizado por motivo atribuível ao profissional ou à plataforma, o cliente terá direito a reembolso integral do valor pago, processado automaticamente no cartão via Mercado Pago.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">4. Forma de Reembolso</h2>
        <p>Todos os reembolsos são processados como estorno automático no cartão de crédito ou débito utilizado no pagamento, por meio do Mercado Pago. O prazo para o valor aparecer na fatura depende da operadora do cartão.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">5. Garantia dos Serviços</h2>
        <p>Os serviços realizados pela plataforma contam com garantia de 30 (trinta) dias. Caso o serviço apresente problema dentro desse prazo, o profissional retornará para corrigir sem custo adicional ao cliente, mediante solicitação pelo suporte.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">6. Como Solicitar</h2>
        <p>O cliente pode solicitar cancelamento diretamente pela plataforma, na área "Meus Pedidos", ou entrando em contato com o suporte pelos canais oficiais.</p>
      </div>
    </div>
  );
}
