import { supabase } from "@/integrations/supabase/client";

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
  const [{ data: jans }, { data: blocs }, { data: orcs }, { data: perfil }] = await Promise.all([
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
      .select("data_agendada")
      .eq("profissional_id", profissionalId)
      .not("data_agendada", "is", null)
      .in("status", ["aprovado", "pago"]),
    supabase
      .from("profissional_perfil")
      .select("duracao_padrao_min")
      .eq("user_id", profissionalId)
      .maybeSingle(),
  ]);
  return {
    janelas: (jans ?? []) as Janela[],
    bloqueios: (blocs ?? []) as Bloqueio[],
    agendados: (orcs ?? []).filter((o: any) => o.data_agendada) as Agendado[],
    duracaoMin: perfil?.duracao_padrao_min ?? 60,
  };
}

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
