import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { OrcamentoRow, OrcMaterial } from "./types";

/**
 * Carrega a lista de orçamentos do cliente logado, materiais associados e
 * propostas recebidas. Mantém sincronia via realtime em orçamentos/propostas.
 */
export function useOrcamentosData(user: User | null) {
  const [list, setList] = useState<OrcamentoRow[]>([]);
  const [orcMats, setOrcMats] = useState<Record<string, OrcMaterial[]>>({});
  const [propostas, setPropostas] = useState<Record<string, any[]>>({});

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: orcError } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });

      if (orcError) {
        console.error(
          "[useOrcamentosData.refresh] erro ao buscar orçamentos",
          orcError,
        );
        toast.error("Não foi possível carregar seus orçamentos.");
        return;
      }

      const rows = ((data as any) ?? []) as OrcamentoRow[];
      setList(rows);

      if (rows.length === 0) return;

      const ids = rows.map((r) => r.id);

      const [{ data: mats, error: matsError }, { data: props, error: propsError }] =
        await Promise.all([
          supabase.from("orcamento_materiais").select("*").in("orcamento_id", ids),
          supabase.from("propostas").select("*").in("orcamento_id", ids),
        ]);

      if (matsError)
        console.error(
          "[useOrcamentosData.refresh] erro ao buscar materiais",
          matsError,
        );
      if (propsError)
        console.error(
          "[useOrcamentosData.refresh] erro ao buscar propostas",
          propsError,
        );

      const grouped: Record<string, OrcMaterial[]> = {};
      (mats ?? []).forEach((m: any) => {
        (grouped[m.orcamento_id] ||= []).push(m as OrcMaterial);
      });
      setOrcMats(grouped);

      const pRows = props ?? [];
      const profIds = Array.from(
        new Set(pRows.map((p) => p.profissional_id).filter(Boolean)),
      );

      const profsMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs, error: profsError } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", profIds);
        if (profsError)
          console.error(
            "[useOrcamentosData.refresh] erro ao buscar perfis",
            profsError,
          );
        (profs ?? []).forEach((pf) => {
          profsMap[pf.id] = pf.nome;
        });
      }

      const propGrouped: Record<string, any[]> = {};
      pRows.forEach((p: any) => {
        const profNome = profsMap[p.profissional_id] || "Profissional";
        (propGrouped[p.orcamento_id] ||= []).push({ ...p, profNome });
      });
      setPropostas(propGrouped);
    } catch (err) {
      console.error("[useOrcamentosData.refresh] erro inesperado", err);
    }
  }, [user]);

  // Initial load + realtime
  useEffect(() => {
    if (!user) return;
    refresh();
    const ch = supabase
      .channel("cli-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orcamentos",
          filter: `cliente_id=eq.${user.id}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "propostas" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { list, orcMats, propostas, refresh };
}
