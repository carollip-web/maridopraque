import { test, expect } from "@playwright/test";
import { slotsDoDia, isAgendaCompativel } from "../../src/lib/agenda.pure.ts";

// Helper: uma data ~14 dias no futuro (evita o filtro de "passado") + seu dia da semana.
function dataFutura() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(0, 0, 0, 0);
  const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { date: d, dia: d.getDay(), str };
}

function isoNoDia(base: Date, h: number, m = 0) {
  const x = new Date(base);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
}

test.describe("agenda — slotsDoDia", () => {
  test("gera 1 slot por hora dentro da janela (08–12, dur 60 → 4 slots)", () => {
    const { date, dia } = dataFutura();
    const slots = slotsDoDia({
      data: date,
      janelas: [{ dia_semana: dia, hora_inicio: "08:00", hora_fim: "12:00" }],
      bloqueios: [],
      agendados: [],
      duracaoMin: 60,
    });
    expect(slots.length).toBe(4);
    expect(slots.map((s) => s.getHours())).toEqual([8, 9, 10, 11]);
  });

  test("sem janela no dia → nenhum slot", () => {
    const { date, dia } = dataFutura();
    const outroDia = (dia + 1) % 7;
    const slots = slotsDoDia({
      data: date,
      janelas: [{ dia_semana: outroDia, hora_inicio: "08:00", hora_fim: "12:00" }],
      bloqueios: [],
      agendados: [],
      duracaoMin: 60,
    });
    expect(slots.length).toBe(0);
  });

  test("bloqueio remove o slot sobreposto (09:00 bloqueado → 3 slots)", () => {
    const { date, dia } = dataFutura();
    const slots = slotsDoDia({
      data: date,
      janelas: [{ dia_semana: dia, hora_inicio: "08:00", hora_fim: "12:00" }],
      bloqueios: [{ data_inicio: isoNoDia(date, 9), data_fim: isoNoDia(date, 10) }],
      agendados: [],
      duracaoMin: 60,
    });
    expect(slots.map((s) => s.getHours())).toEqual([8, 10, 11]);
  });

  test("horário já agendado bloqueia o slot", () => {
    const { date, dia } = dataFutura();
    const slots = slotsDoDia({
      data: date,
      janelas: [{ dia_semana: dia, hora_inicio: "08:00", hora_fim: "12:00" }],
      bloqueios: [],
      agendados: [{ data_agendada: isoNoDia(date, 10), duracao_min: 60 }],
      duracaoMin: 60,
    });
    expect(slots.map((s) => s.getHours())).toEqual([8, 9, 11]);
  });
});

test.describe("agenda — isAgendaCompativel", () => {
  const agendaManha = (dia: number) => ({
    janelas: [{ dia_semana: dia, hora_inicio: "08:00", hora_fim: "12:00" }],
    bloqueios: [],
    agendados: [],
    duracaoMin: 60,
  });

  test("sem data preferida → compatível", () => {
    const r = isAgendaCompativel({ data_preferida: null }, agendaManha(1));
    expect(r.compativel).toBe(true);
  });

  test("data já passou → compatível (combinar no chat)", () => {
    const r = isAgendaCompativel({ data_preferida: "2020-01-01" }, agendaManha(1));
    expect(r.compativel).toBe(true);
    expect(r.motivo).toContain("passou");
  });

  test("dia sem janela → incompatível", () => {
    const { str, dia } = dataFutura();
    const r = isAgendaCompativel({ data_preferida: str }, agendaManha((dia + 1) % 7));
    expect(r.compativel).toBe(false);
    expect(r.motivo).toContain("Sem janelas");
  });

  test("período manhã com janela de manhã → compatível", () => {
    const { str, dia } = dataFutura();
    const r = isAgendaCompativel({ data_preferida: str, periodo_preferido: "manha" }, agendaManha(dia));
    expect(r.compativel).toBe(true);
  });

  test("período noite sem janela à noite → incompatível", () => {
    const { str, dia } = dataFutura();
    const r = isAgendaCompativel({ data_preferida: str, periodo_preferido: "noite" }, agendaManha(dia));
    expect(r.compativel).toBe(false);
    expect(r.motivo).toContain("período");
  });

  test("horário específico exato disponível → compatível", () => {
    const { str, dia } = dataFutura();
    const r = isAgendaCompativel(
      { data_preferida: str, periodo_preferido: "horario_especifico", horario_preferido: "09:00" },
      agendaManha(dia),
    );
    expect(r.compativel).toBe(true);
  });

  test("horário específico rígido e indisponível → incompatível", () => {
    const { str, dia } = dataFutura();
    const r = isAgendaCompativel(
      {
        data_preferida: str,
        periodo_preferido: "horario_especifico",
        horario_preferido: "08:30",
        flexibilidade_agenda: "exato",
      },
      agendaManha(dia),
    );
    expect(r.compativel).toBe(false);
  });
});
