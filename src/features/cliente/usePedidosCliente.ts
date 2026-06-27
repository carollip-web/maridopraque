import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { catalogNameKey, formatCurrency } from "./pedidos.helpers";

// Busca os pedidos do cliente e enriquece cada um com propostas, dados do
// profissional, pagamento mais recente e os rótulos de status/preço usados na UI.
export function usePedidosCliente(userId: string | undefined) {
  return useQuery({
    queryKey: ["cliente", "pedidos", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("orcamentos")
        .select(
          "id, status, created_at, service_id, service_name, descricao, valor, valor_servico, cliente_id, profissional_id, tipo_atendimento, data_preferida, periodo_preferido, horario_preferido, metragem_m2",
        )
        .eq("cliente_id", userId)
        .order("created_at", { ascending: false });

      if (error) console.error("Error fetching orcamentos:", error);

      const list = data || [];

      const catalogMap: Record<string, any> = {};
      if (list.length > 0) {
        const { data: catalogData } = await supabase
          .from("services_catalog_publico")
          .select("id, nome, preco_min, preco_max");
        (catalogData || []).forEach((svc) => {
          if (!svc.id) return;
          catalogMap[svc.id] = svc;
          catalogMap[catalogNameKey(svc.nome)] = svc;
        });
      }

      const orcIds = list.map((o) => o.id);

      // Busca pagamentos separadamente (embed via PostgREST falhava)
      const pagamentosMap: Record<string, any> = {};
      if (orcIds.length > 0) {
        const { data: pagData } = await supabase
          .from("pagamentos")
          .select(
            "orcamento_id, status_autorizacao, confirmacao_profissional_em, confirmacao_cliente_em, metadata, valor_total, created_at",
          )
          .in("orcamento_id", orcIds)
          .order("created_at", { ascending: true });
        (pagData || []).forEach((pg) => {
          pagamentosMap[pg.orcamento_id] = pg; // ordem asc → fica o mais recente
        });
      }

      let propostas: any[] = [];
      const profsMap: Record<
        string,
        {
          nome: string;
          slug?: string;
          media?: string;
          totalAvaliacoes?: number;
          concluidos?: number;
        }
      > = {};

      if (orcIds.length > 0) {
        const { data: pData } = await supabase
          .from("propostas")
          .select("id, orcamento_id, profissional_id, valor_servico, status, observacoes")
          .in("orcamento_id", orcIds);
        propostas = pData || [];
        const profIds = Array.from(new Set(propostas.map((p) => p.profissional_id)));

        if (profIds.length > 0) {
          // fetch names
          const { data: prData } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", profIds);

          // fetch slugs
          const { data: perfilData } = await supabase
            .from("profissional_perfil")
            .select("user_id, slug")
            .in("user_id", profIds);

          // fetch ratings
          const { data: avData } = await supabase
            .from("avaliacoes")
            .select("profissional_id, nota")
            .in("profissional_id", profIds);

          // fetch concluidos
          const { data: concluidosData } = await supabase
            .from("orcamentos")
            .select("profissional_id")
            .in("profissional_id", profIds)
            .eq("status", "concluido");

          (prData || []).forEach((p) => {
            const perf = (perfilData || []).find((pf) => pf.user_id === p.id);
            const avs = (avData || []).filter((av) => av.profissional_id === p.id);
            const concluidosCount = (concluidosData || []).filter(
              (c) => c.profissional_id === p.id,
            ).length;
            const media =
              avs.length > 0
                ? (avs.reduce((acc, a) => acc + a.nota, 0) / avs.length).toFixed(1)
                : undefined;

            profsMap[p.id] = {
              nome: p.nome,
              slug: perf?.slug ?? undefined,
              media,
              totalAvaliacoes: avs.length,
              concluidos: concluidosCount,
            };
          });
        }
      }

      return list.map((o) => {
        const propsForOrc = propostas
          .filter((p) => p.orcamento_id === o.id)
          .map((p) => ({
            ...p,
            profNome: profsMap[p.profissional_id]?.nome || "Profissional",
            profSlug: profsMap[p.profissional_id]?.slug,
            profMedia: profsMap[p.profissional_id]?.media,
            profTotalAvaliacoes: profsMap[p.profissional_id]?.totalAvaliacoes,
            profConcluidos: profsMap[p.profissional_id]?.concluidos,
          }));
        const uiStatus =
          o.status === "customizado_pendente" && propsForOrc.length > 0
            ? "Aguardando sua aprovação"
            : o.status === "customizado_pendente"
              ? "Em Análise"
              : o.status === "enviado"
                ? "Aguardando sua aprovação"
                : o.status === "fixo_auto"
                  ? "Aprovação Automática"
                  : o.status === "aprovado"
                    ? "Agendado"
                    : o.status === "aguardando_pagamento"
                      ? "Aguardando Pagamento"
                      : o.status === "pago"
                        ? "Pago"
                        : o.status === "concluido"
                          ? "Concluído"
                          : o.status === "disputa_resolvida"
                            ? "Disputa Resolvida"
                          : o.status;

        const lastPagamento = pagamentosMap[o.id] || null;

        const catalogSvc =
          (o.service_id ? catalogMap[o.service_id] : null) ??
          catalogMap[catalogNameKey(o.service_name)];
        const unitMin = catalogSvc?.preco_min != null ? Number(catalogSvc.preco_min) : null;
        const unitMax = catalogSvc?.preco_max != null ? Number(catalogSvc.preco_max) : null;
        const metragem = o.metragem_m2 != null ? Number(o.metragem_m2) : 0;
        const isM2 =
          metragem > 0 &&
          /\(m²?\)|\bm2\b|metro quadrado/i.test(`${o.service_name} ${catalogSvc?.nome ?? ""}`);
        const rangeMin = unitMin != null ? unitMin * (isM2 ? metragem : 1) : null;
        const rangeMax = unitMax != null ? unitMax * (isM2 ? metragem : 1) : null;
        const rangeDisplay =
          rangeMin != null && rangeMax != null
            ? rangeMin === rangeMax
              ? formatCurrency(rangeMin)
              : `${formatCurrency(rangeMin)} – ${formatCurrency(rangeMax)}`
            : null;

        return {
          propostas: propsForOrc,
          lastPagamento,
          ...o,
          rawStatus: o.status,
          title: o.service_name,
          description: o.descricao ?? "",
          uiStatus,
          status: uiStatus as string,
          date: new Date(o.created_at).toLocaleDateString(),
          prof: propsForOrc[0]?.profNome || "-",
          price: o.valor
            ? formatCurrency(Number(o.valor))
            : o.valor_servico
              ? formatCurrency(Number(o.valor_servico))
              : "A definir",
          displayPrice:
            propsForOrc[0]?.valor_servico != null
              ? formatCurrency(Number(propsForOrc[0].valor_servico))
              : o.valor != null
                ? formatCurrency(Number(o.valor))
                : (rangeDisplay ??
                  (o.valor_servico != null
                    ? formatCurrency(Number(o.valor_servico))
                    : "A definir")),
          rangeDisplay,
          unitRangeDisplay:
            isM2 && unitMin != null && unitMax != null
              ? `${metragem} m² × ${formatCurrency(unitMin)}–${formatCurrency(unitMax)}/m²`
              : null,
        };
      });
    },
    enabled: !!userId,
  });
}

// Mantém a lista de pedidos do cliente em tempo real: revalida a query quando
// muda um orçamento/proposta do cliente e dispara onAvaliacaoInsert quando uma
// avaliação dele é inserida. A inscrição é refeita só quando o userId muda.
export function usePedidosRealtime(userId: string | undefined, onAvaliacaoInsert: () => void) {
  const queryClient = useQueryClient();
  // Guarda o callback num ref para não reinscrever o canal a cada render.
  const onAvaliacaoRef = useRef(onAvaliacaoInsert);
  onAvaliacaoRef.current = onAvaliacaoInsert;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("cliente-pedidos-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orcamentos",
          filter: `cliente_id=eq.${userId}`,
        },
        async () => {
          queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", userId] });
          await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", userId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "propostas",
        },
        async () => {
          queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", userId] });
          await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", userId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "avaliacoes",
          filter: `cliente_id=eq.${userId}`,
        },
        () => {
          onAvaliacaoRef.current();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
