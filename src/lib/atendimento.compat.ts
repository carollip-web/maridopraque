export type TipoAtendimento = "homem" | "mulher" | "homem_com_apoio_feminino" | null | undefined;

export type GeneroProfissional = "homem" | "mulher" | "outro" | "nao_informar" | null | undefined;

export type AtendimentoCompatibility = {
  compatible: boolean;
  level: "exact" | "alternative" | "warning" | "neutral" | "blocked";
  label: string;
  reason?: string;
  blockProposal?: boolean;
};

export function tipoAtendimentoLabel(tipo: TipoAtendimento): string {
  if (tipo === "mulher") return "Profissional mulher";
  if (tipo === "homem") return "Profissional homem";
  if (tipo === "homem_com_apoio_feminino") return "Profissional + apoio feminino";
  return "Sem preferência informada";
}

export function generoProfissionalLabel(genero: GeneroProfissional): string {
  if (genero === "mulher") return "Mulher";
  if (genero === "homem") return "Homem";
  if (genero === "outro") return "Outro";
  if (genero === "nao_informar") return "Prefiro não informar";
  return "Não informado";
}

export function isProfissionalCompativelComTipoAtendimento(args: {
  tipoAtendimento: TipoAtendimento;
  genero?: GeneroProfissional;
  ofereceApoioFeminino?: boolean | null;
}): AtendimentoCompatibility {
  const { tipoAtendimento, genero, ofereceApoioFeminino } = args;

  if (!tipoAtendimento) {
    return {
      compatible: true,
      level: "neutral",
      label: "Sem preferência de atendimento",
    };
  }

  if (!genero || genero === "nao_informar") {
    return {
      compatible: true,
      level: "warning",
      label: "Compatibilidade a verificar",
      reason: "Complete seu gênero no perfil para receber pedidos mais compatíveis.",
      blockProposal: false,
    };
  }

  if (tipoAtendimento === "mulher") {
    if (genero === "mulher") {
      return {
        compatible: true,
        level: "exact",
        label: "Compatível: profissional mulher",
      };
    }

    return {
      compatible: false,
      level: "blocked",
      label: "Cliente solicitou profissional mulher",
      reason: "Este pedido exige atendimento por uma profissional mulher.",
      blockProposal: true,
    };
  }

  if (tipoAtendimento === "homem") {
    if (genero === "homem") {
      return {
        compatible: true,
        level: "exact",
        label: "Compatível: profissional homem",
      };
    }

    return {
      compatible: false,
      level: "blocked",
      label: "Cliente solicitou profissional homem",
      reason: "Este pedido exige atendimento por um profissional homem.",
      blockProposal: true,
    };
  }

  if (tipoAtendimento === "homem_com_apoio_feminino") {
    if (genero === "homem" && ofereceApoioFeminino) {
      return {
        compatible: true,
        level: "exact",
        label: "Compatível: apoio feminino disponível",
      };
    }

    if (genero === "mulher") {
      return {
        compatible: true,
        level: "alternative",
        label: "Compatível: atendimento feminino",
        reason:
          "A cliente pediu apoio feminino; uma profissional mulher também atende ao critério de conforto.",
      };
    }

    if (genero === "homem" && !ofereceApoioFeminino) {
      return {
        compatible: false,
        level: "blocked",
        label: "Apoio feminino solicitado",
        reason:
          "Este pedido solicita apoio feminino. Ative essa opção no perfil para poder enviar proposta.",
        blockProposal: true,
      };
    }

    return {
      compatible: true,
      level: "warning",
      label: "Apoio feminino precisa ser confirmado",
      reason: "Cliente pediu acompanhamento feminino durante a visita.",
      blockProposal: false,
    };
  }

  return {
    compatible: true,
    level: "neutral",
    label: "Verificar compatibilidade",
  };
}

export function compatibilityBadgeClass(level: AtendimentoCompatibility["level"]) {
  if (level === "exact") return "bg-emerald-100 text-emerald-700";
  if (level === "alternative") return "bg-sky-100 text-sky-700";
  if (level === "warning") return "bg-amber-100 text-amber-700";
  if (level === "blocked") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}
