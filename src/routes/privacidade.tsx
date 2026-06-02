import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Marido pra Quê?" },
      { name: "description", content: "Como a Marido pra Quê? coleta, usa e protege seus dados, em conformidade com a LGPD." },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Política de Privacidade</h1>
      <p className="text-sm text-slate-400 mb-8">Última atualização: [PREENCHER: data]</p>
      <div className="max-w-none space-y-4 text-slate-600 leading-relaxed">
        <p>Esta Política de Privacidade descreve como a Marido pra Quê? coleta, usa, armazena e protege os dados pessoais dos usuários, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">1. Controladora dos Dados</h2>
        <p>A controladora dos dados é [PREENCHER: razão social], CNPJ [PREENCHER], com sede em [PREENCHER: endereço].</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">2. Quais Dados Coletamos</h2>
        <p><strong>De clientes:</strong> nome, e-mail, telefone/WhatsApp, endereço para realização do serviço, dados de pagamento (processados pelo Mercado Pago — não armazenamos o número completo do cartão), histórico de pedidos e avaliações.</p>
        <p><strong>De profissionais:</strong> nome, e-mail, telefone/WhatsApp, CPF e/ou CNPJ, documentos de identificação e foto (selfie de verificação), dados bancários/chave PIX para repasses, endereço e raio de atendimento.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">3. Para Que Usamos os Dados</h2>
        <p>Viabilizar a conexão entre clientes e profissionais; processar pagamentos e repasses; verificar a identidade dos profissionais; comunicar sobre pedidos, agendamentos e propostas; oferecer suporte e mediar disputas; cumprir obrigações legais; e melhorar a plataforma.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">4. Base Legal</h2>
        <p>O tratamento dos dados se fundamenta nas bases legais previstas na LGPD, especialmente: execução de contrato, cumprimento de obrigação legal, legítimo interesse e consentimento do titular, conforme o caso.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">5. Compartilhamento de Dados</h2>
        <p>Os dados podem ser compartilhados com profissionais e clientes (na medida necessária para o serviço), com o Mercado Pago (processamento de pagamentos), com provedores de infraestrutura (hospedagem, banco de dados) e com autoridades públicas quando exigido por lei. Não vendemos dados pessoais a terceiros.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">6. Armazenamento e Segurança</h2>
        <p>Os dados são armazenados em servidores seguros, com medidas técnicas de proteção (criptografia, controle de acesso). Os dados são mantidos pelo tempo necessário para as finalidades descritas ou conforme exigência legal.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">7. Direitos do Titular</h2>
        <p>Nos termos da LGPD, o titular pode, a qualquer momento: confirmar a existência de tratamento de seus dados; acessar seus dados; corrigir dados incompletos ou desatualizados; solicitar anonimização, bloqueio ou eliminação de dados desnecessários; solicitar a portabilidade dos dados; e revogar o consentimento.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">8. Como Exercer Seus Direitos</h2>
        <p>Para exercer qualquer um desses direitos, o titular pode entrar em contato pelo e-mail: [PREENCHER: email de privacidade].</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">9. Cookies</h2>
        <p>A plataforma pode utilizar cookies e tecnologias semelhantes para melhorar a experiência de navegação. O usuário pode gerenciar os cookies nas configurações do navegador.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">10. Alterações nesta Política</h2>
        <p>Esta Política pode ser atualizada periodicamente. Alterações relevantes serão comunicadas aos usuários.</p>

        <h2 className="text-xl font-bold text-slate-800 mt-8 mb-3">11. Encarregado de Dados (DPO)</h2>
        <p>Encarregado pelo tratamento de dados: [PREENCHER: nome do responsável, se houver]. Contato: [PREENCHER: email].</p>
      </div>
    </div>
  );
}
