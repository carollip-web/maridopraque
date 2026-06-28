// Lógica PURA de agenda (sem acesso ao Supabase) — separada para ser testável
// e reutilizável. O carregamento de dados fica em agenda.ts.

export type Janela = { dia_semana: number; hora_inicio: string; hora_fim: string };
export type Bloqueio = { data_inicio: string; data_fim: string };
export type Agendado = { data_agendada: string; duracao_min?: number | null };

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Constrói os slots disponíveis para um profissional em um dia específico (data local),
// descontando bloqueios, horários já agendados e slots no passado.
export function slotsDoDia(opts: {
  data: Date;
  janelas: Janela[];
  bloqueios: Bloqueio[];
  agendados: Agendado[];
  duracaoMin: number;
}): Date[] {
  const { data, janelas, bloqueios, agendados, duracaoMin } = opts;
  const dia = data.getDay();
  const doDia = janelas.filter((j) => j.dia_semana === dia);
  if (doDia.length === 0) return [];

  const slots: Date[] = [];
  const agora = new Date();

  for (const j of doDia) {
    const [hi, mi] = j.hora_inicio.split(":").map(Number);
    const [hf, mf] = j.hora_fim.split(":").map(Number);
    const inicio = new Date(data);
    inicio.setHours(hi, mi, 0, 0);
    const fim = new Date(data);
    fim.setHours(hf, mf, 0, 0);

    let cursor = new Date(inicio);
    while (cursor.getTime() + duracaoMin * 60000 <= fim.getTime()) {
      const slotIni = new Date(cursor);
      const slotFim = new Date(cursor.getTime() + duracaoMin * 60000);

      const bloqueado = bloqueios.some((b) => {
        const bi = new Date(b.data_inicio).getTime();
        const bf = new Date(b.data_fim).getTime();
        return slotIni.getTime() < bf && slotFim.getTime() > bi;
      });

      const ocupado = agendados.some((a) => {
        const ai = new Date(a.data_agendada).getTime();
        const af = ai + (a.duracao_min ?? duracaoMin) * 60000;
        return slotIni.getTime() < af && slotFim.getTime() > ai;
      });

      const passado = slotIni.getTime() <= agora.getTime();

      if (!bloqueado && !ocupado && !passado) slots.push(slotIni);
      cursor = new Date(cursor.getTime() + duracaoMin * 60000);
    }
  }
  return slots;
}

export function isAgendaCompativel(
  orcamento: { data_preferida?: string | null; periodo_preferido?: string | null; horario_preferido?: string | null; flexibilidade_agenda?: string | null },
  agenda: { janelas: Janela[]; bloqueios: Bloqueio[]; agendados: Agendado[]; duracaoMin: number }
): { compativel: boolean; motivo?: string } {
  if (!orcamento.data_preferida) return { compativel: true };

  const data = new Date(orcamento.data_preferida + "T00:00:00");

  // Se a data preferida já passou, a preferência ficou obsoleta — mas o pedido
  // continua válido: o profissional pode assumir e combinar uma nova data no
  // chat. Tratar como compatível evita que pedidos "flexíveis" sumam do radar
  // (e que o envio de proposta seja bloqueado) só porque a data escolhida passou.
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (data.getTime() < hoje.getTime()) {
    return { compativel: true, motivo: "Data preferida já passou — combine uma nova data no chat" };
  }

  const slots = slotsDoDia({
    data,
    janelas: agenda.janelas,
    bloqueios: agenda.bloqueios,
    agendados: agenda.agendados,
    duracaoMin: agenda.duracaoMin,
  });

  if (slots.length === 0) {
    // Verificar se tem slots em dias próximos (opcional para feedback)
    return { compativel: false, motivo: "Sem janelas disponíveis neste dia" };
  }

  if (orcamento.periodo_preferido === "horario_especifico" && orcamento.horario_preferido) {
    const [h, m] = orcamento.horario_preferido.split(":").map(Number);
    const target = new Date(data);
    target.setHours(h, m, 0, 0);

    const exato = slots.some((s) => s.getTime() === target.getTime());
    if (exato) return { compativel: true };

    if (orcamento.flexibilidade_agenda === "exato")
      return { compativel: false, motivo: "Horário específico ocupado ou indisponível" };

    // Se for flexível, qualquer slot no dia serve, mas avisamos que é aproximado
    return { compativel: true, motivo: "Horário exato indisponível, mas há alternativas no dia" };
  }

  // Períodos: manha (7-12), tarde (12-18), noite (18-22)
  const hasInPeriod = slots.some((s) => {
    const hour = s.getHours();
    if (orcamento.periodo_preferido === "manha") return hour >= 7 && hour < 12;
    if (orcamento.periodo_preferido === "tarde") return hour >= 12 && hour < 18;
    if (orcamento.periodo_preferido === "noite") return hour >= 18 && hour < 22;
    return true;
  });

  if (hasInPeriod) return { compativel: true };

  return { compativel: false, motivo: "Sem disponibilidade no período desejado" };
}
