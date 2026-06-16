import { useCallback, useMemo } from "react";
import { distanceKm } from "@/lib/geo";
import { isProfissionalCompativelComTipoAtendimento } from "@/lib/atendimento.compat";
import { Orcamento, ServicoCat, ClienteGeo } from "./types";

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
              tipoAtendimento: (o as unknown as Record<string, unknown>).tipo_atendimento as import("@/lib/agenda").TipoAtendimento,
              genero: profGenero as "homem" | "mulher",
              ofereceApoioFeminino: profApoioFeminino,
            });
            if (!compat.compatible && compat.blockProposal) return false;
          }

          if (especialidades.length > 0) {
            const serviceId = (o as unknown as Record<string, unknown>).service_id;
            if (serviceId) {
              const cat = catalog[serviceId as string]?.categoria?.toLowerCase();
              if (
                cat &&
                !especialidades.map((e) => e.toLowerCase()).includes(cat)
              )
                return false;
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
            (["aprovado", "pago"].includes(o.status) &&
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
