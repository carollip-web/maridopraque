import { supabase } from "@/integrations/supabase/client";
import { type Tables } from "@/integrations/supabase/types";

export type Janela = { dia_semana: number; hora_inicio: string; hora_fim: string };
export type Bloqueio = { data_inicio: string; data_fim: string };
export type Agendado = { data_agendada: string; duracao_min?: number | null };

// Constrói os slots disponíveis para um profissional em um dia específico (data local)
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

export async function carregarAgendaProfissional(profissionalId: string) {
  const [jansRes, blocsRes, orcsRes, perfilRes, pbaRes] = await Promise.all([
    supabase
      .from("profissional_disponibilidade")
      .select("dia_semana, hora_inicio, hora_fim")
      .eq("user_id", profissionalId),
    supabase
      .from("profissional_bloqueios")
      .select("data_inicio, data_fim")
      .eq("user_id", profissionalId),
    supabase
      .from("orcamentos")
      .select("id, data_agendada")
      .eq("profissional_id", profissionalId)
      .not("data_agendada", "is", null)
      .in("status", ["aprovado", "pago"]),
    supabase
      .from("profissional_perfil")
      .select("duracao_padrao_min")
      .eq("user_id", profissionalId)
      .maybeSingle(),
    supabase
      .from("profissional_bloqueios_agenda")
      .select("*")
      .eq("profissional_id", profissionalId)
      .in("status", ["temporario", "confirmado"]),
  ]);

  const jans = jansRes.data;
  const blocs = blocsRes.data;
  const orcs = orcsRes.data;
  const perfil = perfilRes.data;
  const pbaRaw = pbaRes.data;

  if (pbaRes.error) {
    console.warn("[agenda] bloqueios de agenda indisponíveis", pbaRes.error);
  }

  const now = new Date();
  const bloqueiosValidos = ((pbaRaw as Tables<"profissional_bloqueios_agenda">[]) || []).filter((b) => {
    if (b.status !== "temporario") return true;
    if (!b.expires_at) return true;
    return new Date(b.expires_at) > now;
  });

  // Combine traditional blocks with new agenda blocks
  const combinedBlocks = [
    ...(blocs ?? []).map((b) => ({ data_inicio: b.data_inicio, data_fim: b.data_fim })),
    ...bloqueiosValidos.map((p) => ({ data_inicio: p.inicio, data_fim: p.fim })),
  ];

  return {
    janelas: (jans ?? []) as Janela[],
    bloqueios: combinedBlocks,
    agendados: (orcs ?? []) as Agendado[],
    bloqueiosAgenda: bloqueiosValidos, // Keep raw data for detailed UI
    duracaoMin: perfil?.duracao_padrao_min ?? 60,
  };
}

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function isAgendaCompativel(
  orcamento: { data_preferida?: string | null; periodo_preferido?: string | null; horario_preferido?: string | null; flexibilidade_agenda?: string | null },
  agenda: { janelas: Janela[]; bloqueios: Bloqueio[]; agendados: Agendado[]; duracaoMin: number }
): { compativel: boolean; motivo?: string } {
  if (!orcamento.data_preferida) return { compativel: true };

  const data = new Date(orcamento.data_preferida + "T00:00:00");
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
