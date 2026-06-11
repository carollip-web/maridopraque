import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Material, ServiceMaterial, Servico } from "./types";

const EMPTY_SERVICOS: Servico[] = [];
const EMPTY_MATERIAIS: Material[] = [];
const EMPTY_SM: ServiceMaterial[] = [];

/**
 * Carrega catálogo de serviços, materiais e a relação service→materials
 * sugeridos. Disponível para qualquer visitante (sem login).
 *
 * Catálogo é compartilhado entre todas as telas via React Query.
 */
export function useOrcamentoCatalog(
  selServiceId: string,
  picked: Record<string, number>,
) {
  const catalogQuery = useQuery({
    queryKey: ["catalog", "all"],
    staleTime: 5 * 60_000, // 5min — catálogo muda raramente
    queryFn: async () => {
      const [s, m, sm] = await Promise.all([
        supabase
          .from("services_catalog")
          .select("id, nome, categoria, preco_min, preco_max")
          .eq("ativo", true),
        supabase
          .from("materiais")
          .select("id, nome, unidade, preco_atual, preco_fonte")
          .eq("ativo", true),
        supabase.from("service_materiais").select("*"),
      ]);
      return {
        servicos: (s.data ?? []) as Servico[],
        materiais: (m.data ?? []).map((x: any) => ({
          ...x,
          preco_atual: Number(x.preco_atual),
        })) as Material[],
        serviceMats: (sm.data ?? []) as ServiceMaterial[],
      };
    },
  });

  const servicos = catalogQuery.data?.servicos ?? EMPTY_SERVICOS;
  const materiais = catalogQuery.data?.materiais ?? EMPTY_MATERIAIS;
  const serviceMats = catalogQuery.data?.serviceMats ?? EMPTY_SM;

  const selServico = useMemo(
    () => servicos.find((s) => s.id === selServiceId),
    [servicos, selServiceId],
  );

  const sugeridos = useMemo<Material[]>(() => {
    if (!selServiceId) return [];
    const ids = serviceMats
      .filter((sm) => sm.service_id === selServiceId)
      .map((sm) => sm.material_id);
    return materiais.filter((m) => ids.includes(m.id));
  }, [selServiceId, serviceMats, materiais]);

  const subtotalMat = useMemo(
    () =>
      Object.entries(picked).reduce((s, [id, qty]) => {
        const m = materiais.find((x) => x.id === id);
        return s + (m ? Number(m.preco_atual) * qty : 0);
      }, 0),
    [picked, materiais],
  );

  return { servicos, materiais, serviceMats, selServico, sugeridos, subtotalMat };
}
