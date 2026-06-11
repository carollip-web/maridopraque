import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Material, ServiceMaterial, Servico } from "./types";

/**
 * Carrega catálogo de serviços, materiais e a relação service→materials
 * sugeridos. Disponível para qualquer visitante (sem login).
 */
export function useOrcamentoCatalog(selServiceId: string, picked: Record<string, number>) {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [serviceMats, setServiceMats] = useState<ServiceMaterial[]>([]);

  useEffect(() => {
    Promise.all([
      supabase
        .from("services_catalog")
        .select("id, nome, categoria, preco_min, preco_max")
        .eq("ativo", true),
      supabase
        .from("materiais")
        .select("id, nome, unidade, preco_atual, preco_fonte")
        .eq("ativo", true),
      supabase.from("service_materiais").select("*"),
    ]).then(([s, m, sm]) => {
      setServicos((s.data ?? []) as Servico[]);
      setMateriais(
        (m.data ?? []).map((x: any) => ({
          ...x,
          preco_atual: Number(x.preco_atual),
        })),
      );
      setServiceMats((sm.data ?? []) as ServiceMaterial[]);
    });
  }, []);

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
