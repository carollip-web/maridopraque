import { supabase } from "@/integrations/supabase/client";
import { type Tables } from "@/integrations/supabase/types";
import { type Janela, type Agendado } from "./agenda.pure";

// Re-exporta a lógica pura de agenda (slotsDoDia, isAgendaCompativel, tipos,
// DIAS_SEMANA) — testável sem o cliente Supabase (ver agenda.pure.ts).
export * from "./agenda.pure";

export async function carregarAgendaProfissional(profissionalId: string, client = supabase) {
  const [jansRes, blocsRes, orcsRes, perfilRes, pbaRes] = await Promise.all([
    client
      .from("profissional_disponibilidade")
      .select("dia_semana, hora_inicio, hora_fim")
      .eq("user_id", profissionalId),
    client
      .from("profissional_bloqueios")
      .select("data_inicio, data_fim")
      .eq("user_id", profissionalId),
    client
      .from("orcamentos")
      .select("id, data_agendada")
      .eq("profissional_id", profissionalId)
      .not("data_agendada", "is", null)
      .in("status", ["aprovado", "pago"]),
    client
      .from("profissional_perfil")
      .select("duracao_padrao_min")
      .eq("user_id", profissionalId)
      .maybeSingle(),
    client
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
