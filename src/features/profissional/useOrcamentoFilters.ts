import { useCallback, useMemo } from "react";
import { distanceKm } from "@/lib/geo";
import { isProfissionalCompativelComTipoAtendimento } from "@/lib/atendimento.compat";
import { Orcamento, ServicoCat, ClienteGeo } from "./types";

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const specialtyMatchesService = (
  especialidade: string,
  categoria: string | null | undefined,
  serviceName: string | null | undefined,
) => {
  const specialty = normalizeText(especialidade);
  const cat = normalizeText(categoria);
  const name = normalizeText(serviceName);
  if (!specialty) return false;

  return (
    (!!cat && (specialty === cat || specialty.includes(cat) || cat.includes(specialty))) ||
    (!!name && (specialty === name || name.includes(specialty) || specialty.includes(name)))
  );
};

export type OrcamentoFilterType =
  | "oportunidades"
  | "elaboracao"
  | "enviados"
  | "ativos"
  | "finalizados";

interface UseOrcamentoFiltersArgs {
  orcamentos: Orcamento[];
  userId: string | undefined;
  especialidades: string[];
  profGeo: { lat: number | null; lng: number | null; raio: number };
  clienteGeo: Record<string, ClienteGeo>;
  catalog: Record<string, ServicoCat>;
  minhasPropostas: any[];
  recusados: Set<string>;
  propostasEnviadasLocal: Set<string>;
  profGenero: string | null;
  profApoioFeminino: boolean;
  profAtivo: boolean;
}

/**
 * Filtros e contagens dos orçamentos exibidos no painel do profissional.
 * Mantém EXATAMENTE a mesma lógica do route original.
 */
export function useOrcamentoFilters(args: UseOrcamentoFiltersArgs) {
  const {
    orcamentos,
    userId,
    especialidades,
    profGeo,
    clienteGeo,
    catalog,
    minhasPropostas,
    recusados,
    propostasEnviadasLocal,
    profGenero,
    profApoioFeminino,
    profAtivo,
  } = args;

  const distanciaCliente = useCallback(
    (clienteId: string): number | null => {
      if (profGeo.lat == null || profGeo.lng == null) return null;
      const g = clienteGeo[clienteId];
      if (!g || g.lat == null || g.lng == null) return null;
      return distanceKm(
        { lat: profGeo.lat, lng: profGeo.lng },
        { lat: g.lat, lng: g.lng },
      );
    },
    [profGeo, clienteGeo],
  );

  const filterBy = useCallback(
    (type: OrcamentoFilterType | string): Orcamento[] => {
      const jaEnvieiProposta = (orcamentoId: string) =>
        propostasEnviadasLocal.has(orcamentoId) ||
        minhasPropostas.some((p) => p.orcamento_id === orcamentoId);

      return orcamentos.filter((o) => {
        if (type === "oportunidades") {
          // Profissional offline (inativo) não recebe pedidos no radar.
          if (!profAtivo) return false;
          const isApoioFemininoTarget =
            profApoioFeminino &&
            (o as unknown as Record<string, unknown>).tipo_atendimento === "homem_com_apoio_feminino" &&
            !(o as unknown as Record<string, unknown>).apoio_profissional_id &&
            ((o.status as string) === "enviado" ||
              (o.status as string) === "aprovado" ||
              (o.status as string) === "agendado");

          if (profApoioFeminino) {
            if (!isApoioFemininoTarget) return false;
          } else {
            if (!(o.status === "customizado_pendente" || o.status === "enviado"))
              return false;
          }

          if (jaEnvieiProposta(o.id)) return false;
          if (recusados.has(o.id)) return false;

          const d = distanciaCliente(o.cliente_id);
          if (d != null && d > profGeo.raio) return false;

          if (!isApoioFemininoTarget) {
            const compat = isProfissionalCompativelComTipoAtendimento({
              tipoAtendimento: (o as unknown as Record<string, unknown>).tipo_atendimento as import("@/lib/atendimento.compat").TipoAtendimento,
              genero: profGenero as "homem" | "mulher",
              ofereceApoioFeminino: profApoioFeminino,
            });
            if (!compat.compatible && compat.blockProposal) return false;
          }

          if (especialidades.length > 0) {
            const serviceId = (o as unknown as Record<string, unknown>).service_id;
            if (serviceId) {
              const service = catalog[serviceId as string];
              if (
                service &&
                !especialidades.some((e) =>
                  specialtyMatchesService(e, service.categoria, service.nome ?? o.service_name),
                )
              ) {
                return false;
              }
            }
          }

          return true;
        }
        if (type === "elaboracao") {
          return (
            o.profissional_id === userId &&
            o.status === "customizado_pendente" &&
            !jaEnvieiProposta(o.id)
          );
        }
        if (type === "enviados") {
          return (
            (o.status === "customizado_pendente" || o.status === "enviado") &&
            jaEnvieiProposta(o.id)
          );
        }
        if (type === "ativos") {
          const isApoioAceito =
            (o as unknown as Record<string, unknown>).apoio_profissional_id === userId &&
            !["concluido", "recusado", "cancelado"].includes(o.status);
          return (
            (["aprovado", "aguardando_pagamento", "pago"].includes(o.status) &&
              o.profissional_id === userId) ||
            isApoioAceito
          );
        }
        if (type === "finalizados") {
          const isApoioFinalizado =
            (o as unknown as Record<string, unknown>).apoio_profissional_id === userId &&
            ["concluido"].includes(o.status);
          return (
            (["recusado", "cancelado", "concluido"].includes(o.status) &&
              o.profissional_id === userId) ||
            isApoioFinalizado
          );
        }
        return false;
      });
    },
    [
      orcamentos,
      userId,
      especialidades,
      profGeo,
      clienteGeo,
      catalog,
      minhasPropostas,
      recusados,
      propostasEnviadasLocal,
      profGenero,
      profApoioFeminino,
      profAtivo,
      distanciaCliente,
    ],
  );

  const counts = useMemo(
    () => ({
      oportunidades: filterBy("oportunidades").length,
      elaboracao: filterBy("elaboracao").length,
      enviados: filterBy("enviados").length,
      ativos: filterBy("ativos").length,
      finalizados: filterBy("finalizados").length,
    }),
    [filterBy],
  );

  return { filterBy, counts, distanciaCliente };
}
