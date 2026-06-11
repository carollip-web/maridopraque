import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { OrcamentoRow, OrcMaterial } from "./types";

const EMPTY_ROWS: OrcamentoRow[] = [];
const EMPTY_MATS: Record<string, OrcMaterial[]> = {};
const EMPTY_PROPS: Record<string, any[]> = {};

/**
 * Carrega a lista de orçamentos do cliente logado, materiais associados e
 * propostas recebidas. Implementado com React Query — realtime invalida o
 * cache em vez de chamar `refresh()` manualmente.
 */
export function useOrcamentosData(user: User | null) {
  const queryClient = useQueryClient();
  const userId = user?.id;
  const enabled = !!userId;

  // Lista principal
  const listQuery = useQuery({
    queryKey: ["cliente", "orcamentos", userId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("cliente_id", userId!)
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Não foi possível carregar seus orçamentos.");
        throw error;
      }
      return (data ?? []) as OrcamentoRow[];
    },
  });

  const list = listQuery.data ?? EMPTY_ROWS;
  const ids = useMemo(() => list.map((r) => r.id), [list]);
  const idsKey = ids.join(",");

  // Materiais
  const matsQuery = useQuery({
    queryKey: ["cliente", "orcMats", idsKey],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamento_materiais")
        .select("*")
        .in("orcamento_id", ids);
      if (error) throw error;
      const grouped: Record<string, OrcMaterial[]> = {};
      (data ?? []).forEach((m: any) => {
        (grouped[m.orcamento_id] ||= []).push(m as OrcMaterial);
      });
      return grouped;
    },
  });

  // Propostas + nomes dos profissionais
  const propostasQuery = useQuery({
    queryKey: ["cliente", "propostas", idsKey],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data: props, error } = await supabase
        .from("propostas")
        .select("*")
        .in("orcamento_id", ids);
      if (error) throw error;

      const pRows = props ?? [];
      const profIds = Array.from(
        new Set(pRows.map((p: any) => p.profissional_id).filter(Boolean)),
      );

      const profsMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", profIds);
        (profs ?? []).forEach((pf: any) => {
          profsMap[pf.id] = pf.nome;
        });
      }

      const grouped: Record<string, any[]> = {};
      pRows.forEach((p: any) => {
        const profNome = profsMap[p.profissional_id] || "Profissional";
        (grouped[p.orcamento_id] ||= []).push({ ...p, profNome });
      });
      return grouped;
    },
  });

  // Realtime: invalida queries em vez de refetch manual
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("cli-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orcamentos",
          filter: `cliente_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["cliente", "orcamentos", userId],
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "propostas" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["cliente", "propostas"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, queryClient]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["cliente"] });
  }, [queryClient]);

  return {
    list,
    orcMats: matsQuery.data ?? EMPTY_MATS,
    propostas: propostasQuery.data ?? EMPTY_PROPS,
    refresh,
  };
}
