import { createFileRoute } from "@tanstack/react-router";
import {
  Search,
  HelpCircle,
  MessageCircle,
  FileQuestion,
  ShieldCheck,
  CreditCard,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de Ajuda — Perguntas frequentes | Marido pra Quê?" },
      {
        name: "description",
        content:
          "Tire suas dúvidas sobre orçamento, segurança, formas de pagamento e garantia dos serviços. Respostas rápidas e claras.",
      },
      { property: "og:title", content: "Central de Ajuda — Marido pra Quê?" },
      {
        property: "og:description",
        content: "Perguntas frequentes sobre orçamento, segurança e pagamento.",
      },
    ],
  }),
  component: Ajuda,
});

const faqs = [
  {
    category: "Geral",
    icon: HelpCircle,
    questions: [
      {
        q: "Como faço para solicitar um orçamento?",
        a: "Acesse a página de Orçamentos, escolha o serviço, marque os materiais opcionais e envie o pedido. Um profissional retornará com o valor dentro do range de preço.",
      },
      {
        q: "Posso escolher uma profissional mulher?",
        a: "Sem problema! Vamos verificar a disponibilidade na sua região. Caso não haja, você ainda pode contar com a opção de apoio feminino durante a visita para sua segurança e conforto.",
      },
      {
        q: "Atendem aos finais de semana?",
        a: "Sim! Atendemos de segunda a sexta das 08h às 19h e aos sábados das 08h às 14h. Também temos plantão 24h para emergências via WhatsApp.",
      },
    ],
  },
  {
    category: "Segurança",
    icon: ShieldCheck,
    questions: [
      {
        q: "Como é feita a verificação dos profissionais?",
        a: "Todos passam por checagem de antecedentes criminais, verificação de documentos e referências técnicas. Só enviamos profissionais com 100% de aprovação.",
      },
      {
        q: "O que é o serviço com apoio feminino durante a visita?",
        a: "É um protocolo onde o técnico homem realiza o serviço pesado enquanto uma colaboradora mulher acompanha todo o processo para garantir seu conforto e segurança.",
      },
    ],
  },
  {
    category: "Pagamentos",
    icon: CreditCard,
    questions: [
      {
        q: "Quais as formas de pagamento?",
        a: "Aceitamos Pix (com 5% de desconto), Cartão de Crédito (até 10x sem juros) e Débito presencial.",
      },
      {
        q: "Preciso pagar antes do serviço?",
        a: "Não necessariamente. Você pode pagar ao final do serviço ou usar nosso simulador para pagar antecipadamente e garantir seu horário.",
      },
    ],
  },
  {
    category: "Serviços",
    icon: Wrench,
    questions: [
      {
        q: "Os materiais estão inclusos no preço?",
        a: "Geralmente não. Nossos orçamentos focam na mão de obra especializada. Caso precise que compremos o material, cobraremos uma taxa de deslocamento e o valor da nota fiscal.",
      },
      {
        q: "Qual o tempo de garantia?",
        a: "Oferecemos 30 dias de garantia total para qualquer serviço executado. Se houver qualquer problema, voltamos e resolvemos sem custo adicional.",
      },
    ],
  },
];

function Ajuda() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-24">
      <div className="text-center mb-16">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Suporte</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Como podemos ajudar?
        </h1>
        <div className="mt-10 relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Busque por uma dúvida (ex: garantia, pix...)"
            className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
          />
        </div>
      </div>

      <div className="space-y-12">
        {faqs.map((cat) => (
          <div key={cat.category}>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <cat.icon className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold">{cat.category}</h2>
            </div>

            <div className="space-y-3">
              {cat.questions.map((item, idx) => {
                const id = `${cat.category}-${idx}`;
                const isOpen = openIndex === id;
                return (
                  <div
                    key={id}
                    className="rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-brand/20"
                  >
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : id)}
                      className="flex w-full items-center justify-between p-6 text-left"
                    >
                      <span className="font-semibold text-foreground">{item.q}</span>
                      <ChevronDown
                        className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-24 rounded-3xl bg-cream p-10 text-center border border-brand/10">
        <MessageCircle className="h-10 w-10 text-brand mx-auto mb-6" />
        <h2 className="text-2xl font-bold italic">Não encontrou o que procurava?</h2>
        <p className="mt-3 text-muted-foreground">
          Fale diretamente com um consultor humano no WhatsApp. Estamos online agora.
        </p>
        <a
          href="https://wa.me/5521999999999?text=Olá!%20Não%20encontrei%20minha%20dúvida%20na%20central%20de%20ajuda."
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-block rounded-full bg-brand px-10 py-4 font-bold text-brand-foreground shadow-brand transition hover:scale-105"
        >
          Chamar no WhatsApp
        </a>
      </div>
    </div>
  );
}
