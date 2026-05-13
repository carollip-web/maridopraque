// Programa de níveis do profissional — derivado de dados existentes (sem nova tabela)

export type Nivel = {
  nome: "Bronze" | "Prata" | "Ouro" | "Platina";
  cor: string; // tailwind classes
  emoji: string;
  proximo?: { nome: string; faltam: { servicos?: number; nota?: number } };
};

export function calcularNivel(args: { concluidos: number; notaMedia: number }): Nivel {
  const { concluidos, notaMedia } = args;
  if (concluidos >= 50 && notaMedia >= 4.8) {
    return { nome: "Platina", cor: "from-slate-200 to-slate-400 text-slate-900", emoji: "💎" };
  }
  if (concluidos >= 20 && notaMedia >= 4.5) {
    return {
      nome: "Ouro",
      cor: "from-amber-200 to-amber-400 text-amber-900",
      emoji: "🥇",
      proximo: {
        nome: "Platina",
        faltam: { servicos: Math.max(0, 50 - concluidos), nota: Math.max(0, 4.8 - notaMedia) },
      },
    };
  }
  if (concluidos >= 5 && notaMedia >= 4.0) {
    return {
      nome: "Prata",
      cor: "from-slate-100 to-slate-300 text-slate-800",
      emoji: "🥈",
      proximo: {
        nome: "Ouro",
        faltam: { servicos: Math.max(0, 20 - concluidos), nota: Math.max(0, 4.5 - notaMedia) },
      },
    };
  }
  return {
    nome: "Bronze",
    cor: "from-orange-200 to-orange-400 text-orange-900",
    emoji: "🥉",
    proximo: {
      nome: "Prata",
      faltam: { servicos: Math.max(0, 5 - concluidos), nota: Math.max(0, 4.0 - notaMedia) },
    },
  };
}
