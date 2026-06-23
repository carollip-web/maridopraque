import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { carregarAgendaProfissional } from "@/lib/agenda";
import {
  Orcamento,
  Profile,
  ServicoCat,
  OrcMat,
  ClienteGeo,
} from "./types";

// Taxas: 15% plataforma + 4,98% MP (estimado para crédito à vista)
const TAXA_TOTAL = 0.15 + 0.0498;
const liquido = (bruto: number) =>
  Math.round(bruto * (1 - TAXA_TOTAL) * 100) / 100;

/* ─── Local row types (mirror DB / Supabase select results) ─── */

/** Orcamento extended with DB-side apoio feminino columns not in the base interface */
interface OrcamentoWithApoio extends Orcamento {
  apoio_profissional_id?: string | null;
  valor_apoio_feminino?: number | null;
  status_apoio?: string | null;
}

/** Row returned by `select("*")` on the `propostas` table */
type PropostaRow = Tables<"propostas">;

/** Row returned by `select(...)` on `orcamento_materiais` */
interface OrcMatRow {
  orcamento_id: string;
  nome_snapshot: string;
  unidade_snapshot: string;
  quantidade: number;
  subtotal: number;
}

/** Row returned by `select(...)` on `services_catalog` */
interface CatalogRow {
  id: string;
  preco_min: number | null;
  preco_max: number | null;
  categoria: string;
}

/** Row returned by `select(...)` on `cliente_enderecos` */
interface ClienteEnderecoRow {
  user_id: string;
  rotulo: string;
  cep: string | null;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  lat: number | null;
  lng: number | null;
  is_padrao: boolean;
}

/** Partial proposta used in optimistic updates from server responses */
interface PropostaPartial {
  id?: string;
  orcamento_id?: string;
  profissional_id?: string;
  status?: string;
  valor_servico?: number;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Partial orcamento used in optimistic updates from server responses */
interface OrcamentoPartial {
  id?: string;
  status?: string;
  profissional_id?: string | null;
  valor_servico?: number | null;
  updated_at?: string;
}

/** Shape returned by the orcamentos queryFn */
interface OrcamentosQueryData {
  orcamentos: Orcamento[];
  propostasIniciais: PropostaRow[];
}

interface RecusaRow {
  orcamento_id: string;
}

export interface ProfissionalMetrics {
  ganhosMes: number;
  taxaAceitacao: string;
  slaMedioH: string;
  totalConcluidos: number;
  aReceber: number;
  mediaAvaliacoes: string;
}

export interface ProfissionalPerfilState {
  ativo: boolean;
  especialidades: string[];
  profGeo: { lat: number | null; lng: number | null; raio: number };
  profGenero: string | null;
  profApoioFeminino: boolean;
  mpConectado: boolean;
}

interface PerfilRow {
  ativo: boolean;
  especialidades: string[];
  lat: number | null;
  lng: number | null;
  raio_atendimento_km: number | null;
  genero: string | null;
  oferece_apoio_feminino: boolean;
  mp_user_id: string | null;
}

const EMPTY_ORCS: Orcamento[] = [];
const EMPTY_PROPS: PropostaRow[] = [];
const EMPTY_RECUSAS: string[] = [];

/**
 * Encapsula todo o estado e a busca de dados do painel do profissional.
 *
 * Implementação baseada em React Query:
 * - Cada recurso tem sua própria query (cache compartilhado entre abas).
 * - Realtime invalida queries em vez de chamar `refresh()` manualmente.
 * - Mutações usam optimistic updates + invalidate para sincronizar.
 */
export function useProfissionalData(user: User | null) {
  const queryClient = useQueryClient();
  const userId = user?.id;
  const enabled = !!userId;

  // ---- Queries principais ----

  const orcamentosQuery = useQuery({
    queryKey: ["profissional", "orcamentos", userId],
    enabled,
    queryFn: async () => {
      const [propsRes, orcsRes] = await Promise.all([
        supabase
          .from("propostas")
          .select("*, orcamento_id")
          .eq("profissional_id", userId!),
        supabase
          .from("orcamentos")
          .select("*")
          .or(
            `profissional_id.is.null,profissional_id.eq.${userId},status_apoio.eq.buscando,apoio_profissional_id.eq.${userId},tipo_atendimento.eq.homem_com_apoio_feminino`,
          )
          .order("created_at", { ascending: false }),
      ]);

      if (propsRes.error) throw propsRes.error;
      if (orcsRes.error) throw orcsRes.error;

      const propsList = (propsRes.data ?? []) as PropostaRow[];
      const propOrcIds = propsList.map((p) => p.orcamento_id);
      const missingOrcIds = propOrcIds.filter(
        (id) => !orcsRes.data?.some((o) => o.id === id),
      );

      let list = (orcsRes.data || []) as OrcamentoWithApoio[];
      if (missingOrcIds.length > 0) {
        const { data: missingOrcs } = await supabase
          .from("orcamentos")
          .select("*")
          .in("id", missingOrcIds);
        if (missingOrcs) list = [...list, ...(missingOrcs as OrcamentoWithApoio[])];
      }

      // Repasse 30% apoio feminino
      const apoioOrcs = list.filter(
        (o) =>
          o.tipo_atendimento === "homem_com_apoio_feminino" &&
          !o.apoio_profissional_id,
      );
      if (apoioOrcs.length > 0) {
        const apoioIds = apoioOrcs.map((o) => o.id);
        const { data: propostasHomem } = await supabase
          .from("propostas")
          .select("orcamento_id, valor_servico, status, created_at")
          .in("orcamento_id", apoioIds)
          .order("created_at", { ascending: false });
        if (propostasHomem) {
          const valorPorOrc: Record<string, number> = {};
          for (const p of propostasHomem) {
            if (
              valorPorOrc[p.orcamento_id] == null &&
              p.valor_servico != null
            ) {
              valorPorOrc[p.orcamento_id] = Number(p.valor_servico);
            }
          }
          list = list.map((o) => {
            if (
              o.tipo_atendimento === "homem_com_apoio_feminino" &&
              valorPorOrc[o.id] != null
            ) {
              return {
                ...o,
                valor_apoio_feminino:
                  Math.round(valorPorOrc[o.id] * 0.3 * 100) / 100,
              };
            }
            return o;
          });
        }
      }

      return { orcamentos: list as Orcamento[], propostasIniciais: propsList } satisfies OrcamentosQueryData;
    },
  });

  const orcamentos = orcamentosQuery.data?.orcamentos ?? EMPTY_ORCS;
  const orcIds = useMemo(() => orcamentos.map((o) => o.id), [orcamentos]);

  // Propostas detalhadas (após carregar orçamentos) — sobrescreve a lista inicial
  const propostasQuery = useQuery<PropostaRow[]>({
    queryKey: ["profissional", "propostas", userId, orcIds.join(",")],
    enabled: enabled && orcIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propostas")
        .select("*")
        .eq("profissional_id", userId!)
        .in("orcamento_id", orcIds);
      if (error) throw error;
      return (data ?? []) as PropostaRow[];
    },
  });

  const minhasPropostas: PropostaRow[] =
    propostasQuery.data ?? orcamentosQuery.data?.propostasIniciais ?? EMPTY_PROPS;

  const propIds = useMemo(
    () => minhasPropostas.map((p) => p.id).filter(Boolean),
    [minhasPropostas],
  );

  const propostasMateriaisQuery = useQuery({
    queryKey: ["profissional", "propostasMateriais", propIds.join(",")],
    enabled: propIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_materiais")
        .select("*")
        .in("proposta_id", propIds);
      if (error) throw error;
      return data || [];
    },
  });

  const orcMatsQuery = useQuery({
    queryKey: ["profissional", "orcMats", orcIds.join(",")],
    enabled: orcIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamento_materiais")
        .select(
          "orcamento_id, nome_snapshot, unidade_snapshot, quantidade, subtotal",
        )
        .in("orcamento_id", orcIds);
      if (error) throw error;
      const grouped: Record<string, OrcMat[]> = {};
      (data ?? []).forEach((m) => {
        const row: OrcMat = m as unknown as OrcMat;
        (grouped[row.orcamento_id] ||= []).push(row);
      });
      return grouped;
    },
  });

  // Clientes (profiles + endereços)
  const clienteIds = useMemo(
    () => Array.from(new Set(orcamentos.map((o) => o.cliente_id))).sort(),
    [orcamentos],
  );

  const clientesQuery = useQuery({
    queryKey: ["profissional", "clientes", clienteIds.join(",")],
    enabled: clienteIds.length > 0,
    queryFn: async () => {
      const [{ data: profs }, { data: ends }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, nome, whatsapp, email")
          .in("id", clienteIds),
        supabase
          .from("cliente_enderecos")
          .select("user_id, rotulo, cep, logradouro, numero, complemento, bairro, cidade, uf, lat, lng, is_padrao")
          .in("user_id", clienteIds),
      ]);
      const profiles: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => (profiles[p.id] = p as Profile));
      const clienteGeo: Record<string, ClienteGeo> = {};
      const clienteEndereco: Record<string, ClienteEnderecoRow> = {};
      (ends ?? []).forEach((e) => {
        const row = e as unknown as ClienteEnderecoRow;
        const cur = clienteGeo[row.user_id];
        if (!cur || row.is_padrao)
          clienteGeo[row.user_id] = { lat: row.lat, lng: row.lng, cidade: row.cidade };
        
        const curEnd = clienteEndereco[row.user_id];
        if (!curEnd || row.is_padrao)
          clienteEndereco[row.user_id] = row;
      });
      return { profiles, clienteGeo, clienteEndereco };
    },
  });

  // Catálogo de serviços
  const serviceIds = useMemo(
    () =>
      Array.from(
        new Set(orcamentos.map((o) => o.service_id).filter(Boolean) as string[]),
      ).sort(),
    [orcamentos],
  );

  const catalogQuery = useQuery({
    queryKey: ["profissional", "catalog", serviceIds.join(",")],
    enabled: serviceIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services_catalog")
        .select("id, preco_min, preco_max, categoria")
        .in("id", serviceIds);
      if (error) throw error;
      const cmap: Record<string, ServicoCat> = {};
      (data ?? []).forEach((c) => (cmap[c.id] = c as ServicoCat));
      return cmap;
    },
  });

  // Perfil do profissional
  const perfilQuery = useQuery({
    queryKey: ["profissional", "perfil", userId],
    enabled,
    queryFn: async (): Promise<PerfilRow | null> => {
      const { data, error } = await supabase
        .from("profissional_perfil")
        .select(
          "ativo, especialidades, lat, lng, raio_atendimento_km, genero, oferece_apoio_feminino, mp_user_id",
        )
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) {
        const { data: basico } = await supabase
          .from("profissional_perfil")
          .select("ativo, especialidades, lat, lng, raio_atendimento_km")
          .eq("user_id", userId!)
          .maybeSingle();
        if (!basico) return null;
        return {
          ativo: basico.ativo,
          especialidades: basico.especialidades || [],
          lat: basico.lat ?? null,
          lng: basico.lng ?? null,
          raio_atendimento_km: basico.raio_atendimento_km ?? 15,
          genero: null,
          oferece_apoio_feminino: false,
          mp_user_id: null,
        };
      }
      return data as PerfilRow | null;
    },
  });

  // Avaliações
  const avaliacoesQuery = useQuery({
    queryKey: ["profissional", "avaliacoes", userId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select("nota")
        .eq("profissional_id", userId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Recusas
  const recusasQuery = useQuery({
    queryKey: ["profissional", "recusas", userId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamento_recusas")
        .select("orcamento_id")
        .eq("profissional_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => (r as unknown as RecusaRow).orcamento_id);
    },
  });

  // Agenda
  const agendaQuery = useQuery({
    queryKey: ["profissional", "agenda", userId],
    enabled,
    queryFn: () => carregarAgendaProfissional(userId!),
  });

  // Splits (fonte real de ganhos — alinhado com Financeiro)
  const splitsQuery = useQuery({
    queryKey: ["profissional", "splits", userId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamento_splits")
        .select("orcamento_id, valor_profissional, valor_total, status, created_at")
        .eq("profissional_id", userId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Realtime: invalida queries ao receber eventos ----
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("prof-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamentos" },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["profissional", "orcamentos", userId],
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "propostas",
          filter: `profissional_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["profissional", "propostas", userId],
          });
          queryClient.invalidateQueries({
            queryKey: ["profissional", "orcamentos", userId],
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // ---- Derivações de estado ----

  const recusados = useMemo(
    () => new Set(recusasQuery.data ?? EMPTY_RECUSAS),
    [recusasQuery.data],
  );

  // Propostas marcadas otimisticamente como enviadas (até o servidor confirmar)
  const propostasEnviadasLocal = useMemo(
    () =>
      new Set(
        minhasPropostas
          .map((p) => p.orcamento_id)
          .filter(Boolean) as string[],
      ),
    [minhasPropostas],
  );

  const perfil = perfilQuery.data;
  const ativo = !!perfil?.ativo;
  const especialidades = perfil?.especialidades ?? [];
  const profGeo = {
    lat: perfil?.lat ?? null,
    lng: perfil?.lng ?? null,
    raio: perfil?.raio_atendimento_km ?? 15,
  };
  const profGenero = perfil?.genero ?? null;
  const profApoioFeminino = false; // gerenciado pelo admin
  const mpConectado = !!perfil?.mp_user_id;

  const mediaAvaliacoes = useMemo(() => {
    const avs = avaliacoesQuery.data ?? [];
    if (avs.length === 0) return "—";
    return (avs.reduce((acc, a) => acc + a.nota, 0) / avs.length).toFixed(1);
  }, [avaliacoesQuery.data]);

  // Métricas financeiras derivadas
  const metricsComputed = useMemo(() => {
    if (!userId) {
      return {
        ganhosTotais: 0,
        aReceber: 0,
        ticketMedio: 0,
        ganhosMes: 0,
        taxaAceitacao: "—",
        slaMedioH: "—",
        totalConcluidos: 0,
      };
    }

    const list = orcamentos;
    const meus = list.filter((o) => o.profissional_id === userId);
    const pagos = meus.filter(
      (o) => o.status === "pago" || o.status === "concluido",
    );
    const aReceberOrcs = meus.filter((o) => o.status === "pago");

    const meusApoio = (list as OrcamentoWithApoio[]).filter(
      (o) => o.apoio_profissional_id === userId,
    );
    const pagosApoio = meusApoio.filter(
      (o) => o.status === "pago" || o.status === "concluido",
    );
    const aReceberOrcsApoio = meusApoio.filter((o) => o.status === "pago");

    const ganhosNormais = pagos.reduce(
      (acc, o) => acc + liquido(Number(o.valor || 0)),
      0,
    );
    const ganhosApoio = pagosApoio.reduce(
      (acc, o) => acc + liquido(Number((o as OrcamentoWithApoio).valor_apoio_feminino || 0)),
      0,
    );
    const ganhos = ganhosNormais + ganhosApoio;

    const receberNormais = aReceberOrcs.reduce(
      (acc, o) => acc + liquido(Number(o.valor || 0)),
      0,
    );
    const receberApoio = aReceberOrcsApoio.reduce(
      (acc, o) => acc + liquido(Number((o as OrcamentoWithApoio).valor_apoio_feminino || 0)),
      0,
    );
    const receber = receberNormais + receberApoio;

    const totalPagos = pagos.length + pagosApoio.length;
    const ticket = totalPagos > 0 ? ganhos / totalPagos : 0;

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const ganhosM =
      pagos
        .filter((o) => new Date(o.data_pagamento ?? o.updated_at) >= inicioMes)
        .reduce((acc, o) => acc + liquido(Number(o.valor || 0)), 0) +
      pagosApoio
        .filter((o) => new Date(o.data_pagamento ?? o.updated_at) >= inicioMes)
        .reduce(
          (acc, o) =>
            acc + liquido(Number((o as OrcamentoWithApoio).valor_apoio_feminino || 0)),
          0,
        );

    const enviadasOuFinalizadas = [...meus, ...meusApoio].filter((o) =>
      ["enviado", "aprovado", "pago", "concluido", "recusado"].includes(
        o.status,
      ),
    );
    const aceitas = enviadasOuFinalizadas.filter(
      (o) => o.status !== "recusado",
    );
    const taxaAceitacao =
      enviadasOuFinalizadas.length > 0
        ? `${Math.round((aceitas.length / enviadasOuFinalizadas.length) * 100)}%`
        : "—";

    const enviados = [...meus, ...meusApoio].filter((o) =>
      ["enviado", "aprovado", "pago", "concluido"].includes(o.status),
    );
    let slaMedioH = "—";
    if (enviados.length > 0) {
      const horas =
        enviados.reduce((acc, o) => {
          const t =
            (new Date(o.updated_at).getTime() -
              new Date(o.created_at).getTime()) /
            36e5;
          return acc + Math.max(0, t);
        }, 0) / enviados.length;
      slaMedioH =
        horas < 1 ? `${Math.round(horas * 60)} min` : `${horas.toFixed(1)} h`;
    }

    const totalConcluidos =
      meus.filter((o) => o.status === "concluido").length +
      meusApoio.filter((o) => o.status === "concluido").length;

    return {
      ganhosTotais: ganhos,
      aReceber: receber,
      ticketMedio: ticket,
      ganhosMes: ganhosM,
      taxaAceitacao,
      slaMedioH,
      totalConcluidos,
    };
  }, [orcamentos, userId]);

  const loadingList =
    orcamentosQuery.isLoading || (enabled && orcamentosQuery.isPending);

  // ---- Ações (mutações) ----

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["profissional"] });
  }, [queryClient]);

  const recusarMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("Sem usuário");
      const { error } = await supabase
        .from("orcamento_recusas")
        .insert({ orcamento_id: id, profissional_id: userId });
      if (error) throw error;
      return id;
    },
    onMutate: async (id: string) => {
      const key = ["profissional", "recusas", userId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key) ?? [];
      queryClient.setQueryData<string[]>(key, [...previous, id]);
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["profissional", "recusas", userId],
          ctx.previous,
        );
      }
      toast.error("Não foi possível recusar agora.");
    },
    onSuccess: () => {
      toast.success("Pedido recusado e removido do seu radar.");
    },
  });

  const recusarOrcamento = useCallback(
    async (id: string) => {
      if (!userId) return;
      await recusarMutation.mutateAsync(id).catch(() => {});
    },
    [userId, recusarMutation],
  );

  const toggleAtivoMutation = useMutation({
    mutationFn: async (checked: boolean) => {
      if (!userId) throw new Error("Sem usuário");
      const { error } = await supabase.from("profissional_perfil").upsert({
        user_id: userId,
        ativo: checked,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return checked;
    },
    onMutate: async (checked: boolean) => {
      const key = ["profissional", "perfil", userId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PerfilRow | null>(key);
      if (previous) {
        queryClient.setQueryData<PerfilRow | null>(key, {
          ...previous,
          ativo: checked,
        });
      }
      return { previous };
    },
    onError: (err: unknown, _checked, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(
          ["profissional", "perfil", userId],
          ctx.previous,
        );
      }
      toast.error("Erro ao alterar status", { description: err instanceof Error ? err.message : String(err) });
    },
    onSuccess: (checked) => {
      toast.success(
        checked ? "Você está Online e visível" : "Você está Offline",
      );
    },
  });

  const handleToggleAtivo = useCallback(
    (checked: boolean) => {
      toggleAtivoMutation.mutate(checked);
    },
    [toggleAtivoMutation],
  );

  const handleProposalSent = useCallback(
    (
      args: { orcamentoId: string; proposta: PropostaPartial; orcamento: OrcamentoPartial },
      onAfter?: () => void,
    ) => {
      const { orcamentoId, proposta, orcamento } = args;

      // Update otimista nas queries relevantes
      const orcKey = ["profissional", "orcamentos", userId] as const;
      const propKey = [
        "profissional",
        "propostas",
        userId,
        orcIds.join(","),
      ] as const;

      const propostaNormalizada = {
        ...proposta,
        orcamento_id: proposta?.orcamento_id ?? orcamentoId,
        profissional_id: proposta?.profissional_id ?? userId,
        status: proposta?.status ?? "pendente",
      };
      const orcamentoNormalizado = {
        ...orcamento,
        id: orcamentoId,
        status: orcamento?.status ?? "enviado",
      };

      queryClient.setQueryData<OrcamentosQueryData>(orcKey, (prev): OrcamentosQueryData | undefined => {
        if (!prev) return undefined;
        return {
          ...prev,
          orcamentos: prev.orcamentos.map((o) =>
            o.id === orcamentoId ? ({ ...o, ...orcamentoNormalizado } as Orcamento) : o,
          ),
        };
      });

      queryClient.setQueryData<PropostaRow[]>(propKey, (prev) => {
        const list = prev ?? [];
        const idx = list.findIndex((p) =>
          propostaNormalizada.id && p.id
            ? p.id === propostaNormalizada.id
            : p.orcamento_id === propostaNormalizada.orcamento_id,
        );
        if (idx >= 0) {
          const copy = [...list];
          copy[idx] = { ...copy[idx], ...propostaNormalizada } as PropostaRow;
          return copy;
        }
        return [propostaNormalizada as PropostaRow, ...list];
      });

      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
      queryClient.invalidateQueries({ queryKey: ["radar"] });

      onAfter?.();

      // Refresh em background — invalida após pequena espera para o servidor estabilizar
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["profissional"] });
      }, 800);
    },
    [userId, orcIds, queryClient, orcamentosQuery.data],
  );

  // ---- Setter compatível (consumidores antigos que faziam setOrcamentos) ----
  const setOrcamentos = useCallback(
    (updater: Orcamento[] | ((prev: Orcamento[]) => Orcamento[])) => {
      queryClient.setQueryData<OrcamentosQueryData>(
        ["profissional", "orcamentos", userId],
        (prev) => {
          if (!prev) return prev;
          const next =
            typeof updater === "function"
              ? (updater as (p: Orcamento[]) => Orcamento[])(prev.orcamentos)
              : updater;
          return { ...prev, orcamentos: next };
        },
      );
    },
    [queryClient, userId],
  );

  const profiles = clientesQuery.data?.profiles ?? {};
  const clienteGeo = clientesQuery.data?.clienteGeo ?? {};
  const clienteEndereco = clientesQuery.data?.clienteEndereco ?? {};
  const catalog = catalogQuery.data ?? {};
  const orcMats = orcMatsQuery.data ?? {};
  const propostasMateriais = propostasMateriaisQuery.data ?? [];
  const minhaAgenda = agendaQuery.data ?? null;

  return {
    // Dados
    orcamentos,
    setOrcamentos,
    minhasPropostas,
    propostasMateriais,
    profiles,
    catalog,
    orcMats,
    clienteGeo,
    clienteEndereco,
    minhaAgenda,
    loadingList,

    // Perfil
    ativo,
    especialidades,
    profGeo,
    profGenero,
    profApoioFeminino,
    mpConectado,

    // Métricas
    mediaAvaliacoes,
    ganhosTotais: metricsComputed.ganhosTotais,
    aReceber: metricsComputed.aReceber,
    ticketMedio: metricsComputed.ticketMedio,
    metrics: {
      ganhosMes: metricsComputed.ganhosMes,
      taxaAceitacao: metricsComputed.taxaAceitacao,
      slaMedioH: metricsComputed.slaMedioH,
      totalConcluidos: metricsComputed.totalConcluidos,
      aReceber: metricsComputed.aReceber,
      mediaAvaliacoes,
    } as ProfissionalMetrics,

    // Estado interno usado pelos filtros
    recusados,
    propostasEnviadasLocal,

    // Ações
    refresh,
    recusarOrcamento,
    handleProposalSent,
    handleToggleAtivo,
  };
}
