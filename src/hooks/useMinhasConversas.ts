import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Conversa {
  orcamentoId: string;
  contraparteId: string;
  contraparteNome: string;
  serviceName: string;
  ultimaMensagem: string;
  ultimaData: string;
  naoLidas: number;
}

interface MensagemRow {
  id: string;
  orcamento_id: string;
  remetente_id: string;
  destinatario_id: string;
  texto: string;
  lida: boolean;
  created_at: string;
}

export function useMinhasConversas() {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: msgs } = await supabase
      .from("mensagens")
      .select("*")
      .or(`remetente_id.eq.${user.id},destinatario_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    const lista = (msgs as MensagemRow[] | null) ?? [];

    // Agrupa por orcamento_id, mantendo a mais recente primeiro
    const porOrc = new Map<string, MensagemRow[]>();
    for (const m of lista) {
      const arr = porOrc.get(m.orcamento_id) ?? [];
      arr.push(m);
      porOrc.set(m.orcamento_id, arr);
    }

    const orcamentoIds = Array.from(porOrc.keys());
    if (orcamentoIds.length === 0) {
      setConversas([]);
      setLoading(false);
      return;
    }

    const { data: orcs } = await supabase
      .from("orcamentos")
      .select("id, service_name, cliente_id, profissional_id")
      .in("id", orcamentoIds);

    const contraparteIds = new Set<string>();
    for (const m of lista) {
      const outro = m.remetente_id === user.id ? m.destinatario_id : m.remetente_id;
      if (outro) contraparteIds.add(outro);
    }

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", Array.from(contraparteIds));

    const profMap = new Map<string, { nome: string | null; email: string | null }>();
    (profs ?? []).forEach((p: any) => profMap.set(p.id, { nome: p.nome, email: p.email }));

    const orcMap = new Map<string, any>();
    (orcs ?? []).forEach((o: any) => orcMap.set(o.id, o));

    const convs: Conversa[] = orcamentoIds.map((oid) => {
      const ms = porOrc.get(oid)!; // já ordenado desc
      const ultima = ms[0];
      const contraparteId =
        ultima.remetente_id === user.id ? ultima.destinatario_id : ultima.remetente_id;
      const prof = profMap.get(contraparteId);
      const orc = orcMap.get(oid);
      const naoLidas = ms.filter((m) => !m.lida && m.destinatario_id === user.id).length;
      return {
        orcamentoId: oid,
        contraparteId,
        contraparteNome: prof?.nome || prof?.email || "Usuário",
        serviceName: orc?.service_name || "Pedido",
        ultimaMensagem: ultima.texto,
        ultimaData: ultima.created_at,
        naoLidas,
      };
    });

    convs.sort((a, b) => +new Date(b.ultimaData) - +new Date(a.ultimaData));
    setConversas(convs);
    setLoading(false);
  }, [user?.id]);

  const carregarRef = useRef(carregar);
  useEffect(() => {
    carregarRef.current = carregar;
  }, [carregar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Realtime: novas mensagens recebidas OU enviadas pelo usuário
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const channelName = `minhas-conversas-${userId}-${Math.random().toString(36).slice(2)}`;
    const trigger = () => {
      carregarRef.current();
    };
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `destinatario_id=eq.${userId}`,
        },
        trigger,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `remetente_id=eq.${userId}`,
        },
        trigger,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mensagens",
          filter: `destinatario_id=eq.${userId}`,
        },
        trigger,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const marcarConversaLida = useCallback(
    async (orcamentoId: string) => {
      if (!user?.id) return;
      await supabase
        .from("mensagens")
        .update({ lida: true })
        .eq("orcamento_id", orcamentoId)
        .eq("destinatario_id", user.id)
        .eq("lida", false);
      setConversas((prev) =>
        prev.map((c) => (c.orcamentoId === orcamentoId ? { ...c, naoLidas: 0 } : c)),
      );
    },
    [user?.id],
  );

  const totalNaoLidas = conversas.reduce((s, c) => s + c.naoLidas, 0);

  return { conversas, loading, marcarConversaLida, refresh: carregar, totalNaoLidas };
}

export function formatHoraRelativa(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `${dias}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
