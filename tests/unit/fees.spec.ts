import { test, expect } from "@playwright/test";
import {
  MARKETPLACE_FEE,
  APOIO_SURCHARGE,
  round2,
  calcularValores,
  valorBaseDeTotal,
} from "../../supabase/functions/_shared/fees.ts";

test.describe("fees — constantes", () => {
  test("comissão do marketplace é 15% e apoio é 30%", () => {
    expect(MARKETPLACE_FEE).toBe(0.15);
    expect(APOIO_SURCHARGE).toBe(0.3);
  });
});

test.describe("fees — round2", () => {
  test("arredonda para 2 casas (centavos)", () => {
    expect(round2(15.0015)).toBe(15.0);
    expect(round2(8.585)).toBe(8.59); // half-up
    expect(round2(10.005)).toBe(10.01);
  });

  test("trata entradas inválidas como 0", () => {
    expect(round2(NaN)).toBe(0);
    // @ts-expect-error — validando robustez contra undefined em runtime
    expect(round2(undefined)).toBe(0);
  });
});

test.describe("fees — calcularValores (sem apoio)", () => {
  test("split 1:1 de um serviço de R$ 200", () => {
    const v = calcularValores(200, false);
    expect(v.valorBase).toBe(200);
    expect(v.valorApoio).toBe(0);
    expect(v.valorTotal).toBe(200);
    expect(v.marketplaceFee).toBe(30); // 15% de 200
    expect(v.applicationFee).toBe(30); // sem apoio, application_fee = comissão
    expect(v.valorProfissional).toBe(170); // 85% de 200
  });

  test("a comissão + o repasse fecham com a base (tolerância de 1 centavo)", () => {
    // comissão e repasse são arredondados de forma independente (como no
    // webhook em produção), então a soma pode divergir da base em até R$ 0,01.
    const v = calcularValores(347.9, false);
    expect(Math.abs(v.marketplaceFee + v.valorProfissional - v.valorBase)).toBeLessThanOrEqual(
      0.01,
    );
  });
});

test.describe("fees — calcularValores (com apoio feminino)", () => {
  test("adiciona 30% de apoio e inclui no application_fee", () => {
    const v = calcularValores(200, true);
    expect(v.valorBase).toBe(200);
    expect(v.valorApoio).toBe(60); // 30% de 200
    expect(v.valorTotal).toBe(260); // base + apoio
    expect(v.marketplaceFee).toBe(30); // 15% da base
    expect(v.applicationFee).toBe(90); // comissão (30) + apoio (60)
    expect(v.valorProfissional).toBe(170); // 85% da base — não muda com apoio
  });

  test("o cliente paga total e o marketplace retém application_fee", () => {
    const v = calcularValores(450, true);
    // valor que sobra para o profissional via MP = total - application_fee
    expect(round2(v.valorTotal - v.applicationFee)).toBe(v.valorProfissional);
  });
});

test.describe("fees — valorBaseDeTotal (inverso usado no webhook)", () => {
  test("recupera a base a partir do total sem apoio", () => {
    expect(valorBaseDeTotal(200, false)).toBe(200);
  });

  test("recupera a base a partir do total com apoio (÷1.30)", () => {
    expect(valorBaseDeTotal(260, true)).toBe(200);
  });

  test("round-trip: calcularValores → valorBaseDeTotal reconstrói a base", () => {
    for (const base of [100, 150.5, 299.99, 1000, 47.37]) {
      for (const apoio of [false, true]) {
        const { valorTotal } = calcularValores(base, apoio);
        expect(valorBaseDeTotal(valorTotal, apoio)).toBe(round2(base));
      }
    }
  });
});
