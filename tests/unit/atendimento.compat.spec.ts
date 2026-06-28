import { test, expect } from "@playwright/test";
import {
  isProfissionalCompativelComTipoAtendimento as compat,
  tipoAtendimentoLabel,
  generoProfissionalLabel,
} from "../../src/lib/atendimento.compat.ts";

test.describe("atendimento.compat — sem preferência / perfil incompleto", () => {
  test("sem tipo de atendimento → compatível (neutro)", () => {
    const r = compat({ tipoAtendimento: null, genero: "homem" });
    expect(r.compatible).toBe(true);
    expect(r.level).toBe("neutral");
    expect(r.blockProposal).toBeFalsy();
  });

  test("gênero não informado → compatível com aviso, não bloqueia", () => {
    const r = compat({ tipoAtendimento: "mulher", genero: "nao_informar" });
    expect(r.compatible).toBe(true);
    expect(r.level).toBe("warning");
    expect(r.blockProposal).toBe(false);
  });
});

test.describe("atendimento.compat — exige profissional mulher", () => {
  test("mulher atende → compatível exato", () => {
    const r = compat({ tipoAtendimento: "mulher", genero: "mulher" });
    expect(r.compatible).toBe(true);
    expect(r.level).toBe("exact");
  });

  test("homem NÃO atende → bloqueado (blockProposal)", () => {
    const r = compat({ tipoAtendimento: "mulher", genero: "homem" });
    expect(r.compatible).toBe(false);
    expect(r.level).toBe("blocked");
    expect(r.blockProposal).toBe(true);
  });
});

test.describe("atendimento.compat — exige profissional homem", () => {
  test("homem atende → exato", () => {
    expect(compat({ tipoAtendimento: "homem", genero: "homem" }).level).toBe("exact");
  });
  test("mulher NÃO atende → bloqueado", () => {
    const r = compat({ tipoAtendimento: "homem", genero: "mulher" });
    expect(r.compatible).toBe(false);
    expect(r.blockProposal).toBe(true);
  });
});

test.describe("atendimento.compat — homem com apoio feminino", () => {
  test("homem que oferece apoio → exato", () => {
    const r = compat({
      tipoAtendimento: "homem_com_apoio_feminino",
      genero: "homem",
      ofereceApoioFeminino: true,
    });
    expect(r.compatible).toBe(true);
    expect(r.level).toBe("exact");
  });

  test("profissional de apoio feminino → exato", () => {
    expect(
      compat({ tipoAtendimento: "homem_com_apoio_feminino", genero: "apoio_feminino" }).level,
    ).toBe("exact");
  });

  test("mulher → alternativa compatível", () => {
    const r = compat({ tipoAtendimento: "homem_com_apoio_feminino", genero: "mulher" });
    expect(r.compatible).toBe(true);
    expect(r.level).toBe("alternative");
  });

  test("homem sem apoio → alternativa (plataforma fornece apoio), não bloqueia", () => {
    const r = compat({
      tipoAtendimento: "homem_com_apoio_feminino",
      genero: "homem",
      ofereceApoioFeminino: false,
    });
    expect(r.compatible).toBe(true);
    expect(r.level).toBe("alternative");
    expect(r.blockProposal).toBeFalsy();
  });
});

test.describe("atendimento.compat — labels", () => {
  test("tipoAtendimentoLabel", () => {
    expect(tipoAtendimentoLabel("mulher")).toBe("Profissional mulher");
    expect(tipoAtendimentoLabel("homem_com_apoio_feminino")).toBe("Profissional + apoio feminino");
    expect(tipoAtendimentoLabel(null)).toBe("Sem preferência informada");
  });
  test("generoProfissionalLabel", () => {
    expect(generoProfissionalLabel("apoio_feminino")).toBe("Apoio Feminino");
    expect(generoProfissionalLabel(null)).toBe("Não informado");
  });
});
