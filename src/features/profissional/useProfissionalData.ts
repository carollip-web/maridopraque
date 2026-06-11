import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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

/**
 * Encapsula todo o estado e a busca de dados do painel do profissional.
 * O componente de rota fica responsável apenas pela orquestração visual.
 */
export function useProfissionalData(user: User | null) {
  const queryClient = useQueryClient();

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [minhasPropostas, setMinhasPropostas] = useState<any[]>([]);
  const [propostasMateriais, setPropostasMateriais] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [catalog, setCatalog] = useState<Record<string, ServicoCat>>({});
  const [orcMats, setOrcMats] = useState<Record<string, OrcMat[]>>({});
  const [clienteGeo, setClienteGeo] = useState<Record<string, ClienteGeo>>({});
  const [minhaAgenda, setMinhaAgenda] = useState<any>(null);
  const [loadingList, setLoadingList] = useState(true);

  const [ativo, setAtivo] = useState(false);
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [profGeo, setProfGeo] = useState<ProfissionalPerfilState["profGeo"]>({
    lat: null,
    lng: null,
    raio: 15,
  });
  const [profGenero, setProfGenero] = useState<string | null>(null);
  const [profApoioFeminino, setProfApoioFeminino] = useState(false);
  const [mpConectado, setMpConectado] = useState(false);

  const [mediaAvaliacoes, setMediaAvaliacoes] = useState<string>("—");
  const [ganhosTotais, setGanhosTotais] = useState(0);
  const [aReceber, setAReceber] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [ganhosMes, setGanhosMes] = useState(0);
  const [taxaAceitacao, setTaxaAceitacao] = useState<string>("—");
  const [slaMedioH, setSlaMedioH] = useState<string>("—");
  const [totalConcluidos, setTotalConcluidos] = useState(0);

  const [recusados, setRecusados] = useState<Set<string>>(new Set());
  const [propostasEnviadasLocal, setPropostasEnviadasLocal] = useState<
    Set<string>
  >(new Set());

  const refresh = useCallback(async () => {
    if (!user) return;

    // 1. Fetch in parallel
    const [propsRes, orcsRes] = await Promise.all([
      supabase
        .from("propostas")
        .select("*, orcamento_id")
        .eq("profissional_id", user.id),
      supabase
        .from("orcamentos")
        .select("*")
        .or(
          `profissional_id.is.null,profissional_id.eq.${user.id},status_apoio.eq.buscando,apoio_profissional_id.eq.${user.id},tipo_atendimento.eq.homem_com_apoio_feminino`,
        )
        .order("created_at", { ascending: false }),
    ]);

    if (propsRes.error) {
      console.error(
        "[useProfissionalData.refresh] erro ao buscar propostas",
        propsRes.error,
      );
    }
    if (orcsRes.error) {
      console.error(
        "[useProfissionalData.refresh] erro ao buscar orçamentos",
        orcsRes.error,
      );
    }

    const propsList = propsRes.error ? null : propsRes.data || [];
    const propOrcIds = (propsList || []).map((p) => p.orcamento_id);
    const missingOrcIds = propOrcIds.filter(
      (id) => !orcsRes.data?.some((o) => o.id === id),
    );

    let list = (orcsRes.data || []) as Orcamento[];
    if (missingOrcIds.length > 0) {
      const { data: missingOrcs } = await supabase
        .from("orcamentos")
        .select("*")
        .in("id", missingOrcIds);
      if (missingOrcs) list = [...list, ...(missingOrcs as Orcamento[])];
    }

    if (propsList !== null) setMinhasPropostas(propsList);

    // Repasse 30% para apoio feminino (sobre o valor cotado pelo homem)
    const apoioOrcs = (list as any[]).filter(
      (o) =>
        o.tipo_atendimento === "homem_com_apoio_feminino" &&
        !o.apoio_profissional_id,
    );
    if (apoioOrcs.length > 0) {
      const apoioIds = apoioOrcs.map((o) => o.id);
      const { data: propostasHomem } = await (supabase as any)
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
        list = (list as any[]).map((o) => {
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
        }) as typeof list;
      }
    }

    setOrcamentos(list);

    const agenda = await carregarAgendaProfissional(user.id);
    setMinhaAgenda(agenda);

    // Métricas financeiras
    const meus = list.filter((o) => o.profissional_id === user.id);
    const pagos = meus.filter(
      (o) => o.status === "pago" || o.status === "concluido",
    );
    const aReceberOrcs = meus.filter((o) => o.status === "pago");

    const meusApoio = list.filter(
      (o) => (o as any).apoio_profissional_id === user.id,
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
      (acc, o) =>
        acc + liquido(Number((o as any).valor_apoio_feminino || 0)),
      0,
    );
    const ganhos = ganhosNormais + ganhosApoio;

    const receberNormais = aReceberOrcs.reduce(
      (acc, o) => acc + liquido(Number(o.valor || 0)),
      0,
    );
    const receberApoio = aReceberOrcsApoio.reduce(
      (acc, o) =>
        acc + liquido(Number((o as any).valor_apoio_feminino || 0)),
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
        .filter(
          (o) => new Date(o.data_pagamento ?? o.updated_at) >= inicioMes,
        )
        .reduce((acc, o) => acc + liquido(Number(o.valor || 0)), 0) +
      pagosApoio
        .filter(
          (o) => new Date(o.data_pagamento ?? o.updated_at) >= inicioMes,
        )
        .reduce(
          (acc, o) =>
            acc + liquido(Number((o as any).valor_apoio_feminino || 0)),
          0,
        );
    setGanhosMes(ganhosM);

    const enviadasOuFinalizadas = [...meus, ...meusApoio].filter((o) =>
      ["enviado", "aprovado", "pago", "concluido", "recusado"].includes(
        o.status,
      ),
    );
    const aceitas = enviadasOuFinalizadas.filter((o) => o.status !== "recusado");
    setTaxaAceitacao(
      enviadasOuFinalizadas.length > 0
        ? `${Math.round((aceitas.length / enviadasOuFinalizadas.length) * 100)}%`
        : "—",
    );

    const enviados = [...meus, ...meusApoio].filter((o) =>
      ["enviado", "aprovado", "pago", "concluido"].includes(o.status),
    );
    if (enviados.length > 0) {
      const horas =
        enviados.reduce((acc, o) => {
          const t =
            (new Date(o.updated_at).getTime() -
              new Date(o.created_at).getTime()) /
            36e5;
          return acc + Math.max(0, t);
        }, 0) / enviados.length;
      setSlaMedioH(
        horas < 1 ? `${Math.round(horas * 60)} min` : `${horas.toFixed(1)} h`,
      );
    }

    setTotalConcluidos(
      meus.filter((o) => o.status === "concluido").length +
        meusApoio.filter((o) => o.status === "concluido").length,
    );
    setGanhosTotais(ganhos);
    setAReceber(receber);
    setTicketMedio(ticket);

    // Perfil do profissional
    let perfil: any = null;
    const { data: perfilCompleto, error: perfilCompletoError } = await (
      supabase as any
    )
      .from("profissional_perfil")
      .select(
        "ativo, especialidades, lat, lng, raio_atendimento_km, genero, oferece_apoio_feminino, mp_user_id",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (perfilCompletoError) {
      console.warn(
        "[useProfissionalData] perfil completo indisponível, tentando básico",
        perfilCompletoError,
      );
      const { data: perfilBasico } = await (supabase as any)
        .from("profissional_perfil")
        .select("ativo, especialidades, lat, lng, raio_atendimento_km")
        .eq("user_id", user.id)
        .maybeSingle();
      if (perfilBasico && typeof perfilBasico === "object") {
        const pb = perfilBasico as any;
        perfil = {
          ativo: pb.ativo,
          especialidades: pb.especialidades || [],
          lat: pb.lat ?? null,
          lng: pb.lng ?? null,
          raio_atendimento_km: pb.raio_atendimento_km ?? 15,
          genero: null,
          oferece_apoio_feminino: false,
        };
      }
    } else {
      perfil = perfilCompleto;
    }

    if (perfil) {
      setAtivo(perfil.ativo);
      setEspecialidades(perfil.especialidades || []);
      setProfGeo({
        lat: perfil.lat ?? null,
        lng: perfil.lng ?? null,
        raio: perfil.raio_atendimento_km ?? 15,
      });
      setProfGenero(perfil.genero ?? null);
      // Apoio feminino agora é gerenciado pelo admin
      setProfApoioFeminino(false);
      setMpConectado(!!perfil.mp_user_id);
    }

    const { data: avs } = await supabase
      .from("avaliacoes")
      .select("nota")
      .eq("profissional_id", user.id);
    if (avs && avs.length > 0) {
      setMediaAvaliacoes(
        (avs.reduce((acc, a) => acc + a.nota, 0) / avs.length).toFixed(1),
      );
    }

    const { data: recs } = await supabase
      .from("orcamento_recusas")
      .select("orcamento_id")
      .eq("profissional_id", user.id);
    setRecusados(new Set((recs ?? []).map((r: any) => r.orcamento_id)));

    // Dados dos clientes
    const ids = Array.from(new Set(list.map((o) => o.cliente_id)));
    if (ids.length) {
      const [{ data: profs }, { data: ends }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, nome, whatsapp, email")
          .in("id", ids),
        supabase
          .from("cliente_enderecos")
          .select("user_id, lat, lng, cidade, is_padrao")
          .in("user_id", ids),
      ]);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);
      const gmap: Record<string, ClienteGeo> = {};
      (ends ?? []).forEach((e: any) => {
        const cur = gmap[e.user_id];
        if (!cur || e.is_padrao)
          gmap[e.user_id] = { lat: e.lat, lng: e.lng, cidade: e.cidade };
      });
      setClienteGeo(gmap);
    }

    // Catálogo de serviços
    const serviceIds = Array.from(
      new Set(list.map((o) => o.service_id).filter(Boolean) as string[]),
    );
    if (serviceIds.length) {
      const { data: cats } = await supabase
        .from("services_catalog")
        .select("id, preco_min, preco_max, categoria")
        .in("id", serviceIds);
      const cmap: Record<string, ServicoCat> = {};
      (cats ?? []).forEach((c: any) => (cmap[c.id] = c));
      setCatalog(cmap);
    }

    // Materiais e propostas detalhadas
    const orcIds = list.map((o) => o.id);
    if (orcIds.length) {
      const propsRes2 = await (supabase as any)
        .from("propostas")
        .select("*")
        .eq("profissional_id", user.id)
        .in("orcamento_id", orcIds);
      if (propsRes2.error) {
        console.error(
          "[useProfissionalData.refresh] erro ao buscar propostas (2)",
          propsRes2.error,
        );
      } else {
        setMinhasPropostas(propsRes2.data || []);
      }
      const propsData = propsRes2.data;
      const propIds = (propsData || []).map((p: any) => p.id);
      if (propIds.length > 0) {
        const { data: pmData } = await supabase
          .from("proposta_materiais")
          .select("*")
          .in("proposta_id", propIds);
        setPropostasMateriais(pmData || []);
      }

      const { data: oms } = await supabase
        .from("orcamento_materiais")
        .select(
          "orcamento_id, nome_snapshot, unidade_snapshot, quantidade, subtotal",
        )
        .in("orcamento_id", orcIds);
      const grouped: Record<string, OrcMat[]> = {};
      (oms ?? []).forEach((m: any) => {
        (grouped[m.orcamento_id] ||= []).push(m as OrcMat);
      });
      setOrcMats(grouped);
    }

    setLoadingList(false);
  }, [user]);

  // Carregamento inicial + realtime
  useEffect(() => {
    if (!user) return;
    refresh();
    const channel = supabase
      .channel("prof-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamentos" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "propostas",
          filter: `profissional_id=eq.${user.id}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---- Ações ----

  const recusarOrcamento = useCallback(
    async (id: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("orcamento_recusas")
        .insert({ orcamento_id: id, profissional_id: user.id });
      if (error) {
        toast.error("Não foi possível recusar agora.");
        return;
      }
      setRecusados((s) => new Set(s).add(id));
      toast.success("Pedido recusado e removido do seu radar.");
    },
    [user],
  );

  const handleProposalSent = useCallback(
    (
      args: { orcamentoId: string; proposta: any; orcamento: any },
      onAfter?: () => void,
    ) => {
      const { orcamentoId, proposta, orcamento } = args;

      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
      queryClient.invalidateQueries({ queryKey: ["profissional"] });
      queryClient.invalidateQueries({ queryKey: ["radar"] });

      setPropostasEnviadasLocal((prev) => {
        const next = new Set(prev);
        next.add(orcamentoId);
        return next;
      });

      const propostaNormalizada = {
        ...proposta,
        orcamento_id: proposta?.orcamento_id ?? orcamentoId,
        profissional_id: proposta?.profissional_id ?? user?.id,
        status: proposta?.status ?? "pendente",
      };
      const orcamentoNormalizado = {
        ...orcamento,
        id: orcamentoId,
        status: orcamento?.status ?? "enviado",
      };

      setOrcamentos((prev) =>
        prev.map((o) =>
          o.id === orcamentoId ? { ...o, ...orcamentoNormalizado } : o,
        ),
      );

      setMinhasPropostas((prev) => {
        const idx = prev.findIndex((p) =>
          propostaNormalizada.id && p.id
            ? p.id === propostaNormalizada.id
            : p.orcamento_id === propostaNormalizada.orcamento_id,
        );
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...propostaNormalizada };
          return copy;
        }
        return [propostaNormalizada, ...prev];
      });

      onAfter?.();

      // Refresh em background sem sobrescrever estado otimista
      setTimeout(() => {
        refresh();
      }, 800);
    },
    [user?.id, queryClient, refresh],
  );

  const handleToggleAtivo = useCallback(
    async (checked: boolean) => {
      if (!user) return;
      setAtivo(checked);
      const { error } = await supabase.from("profissional_perfil").upsert({
        user_id: user.id,
        ativo: checked,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        setAtivo(!checked);
        toast.error("Erro ao alterar status", { description: error.message });
      } else {
        toast.success(
          checked ? "Você está Online e visível" : "Você está Offline",
        );
      }
    },
    [user],
  );

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
    ganhosTotais,
    aReceber,
    ticketMedio,
    metrics: {
      ganhosMes,
      taxaAceitacao,
      slaMedioH,
      totalConcluidos,
      aReceber,
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
