import React, { useState } from "react";
import { User, MapPin, Camera, Calendar, Clock, CheckCircle2, AlertCircle, Sunrise, Sun, Moon } from "lucide-react";
import { isAgendaCompativel } from "@/lib/agenda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SLABadge } from "@/components/SLABadge";
import { PhotoUploader } from "@/components/PhotoUploader";
import { Button } from "@/components/ui/button";
import { Orcamento, Profile, ServicoCat, OrcMat } from "./types";
import { STATUS_META } from "./constants";

interface OrcamentoCardProps {
  o: Orcamento;
  cliente: Profile | undefined;
  clienteCidade: string | null;
  distanciaKm: number | null;
  range: ServicoCat | undefined;
  materiais: OrcMat[];
  mode: "pegar" | "enviar" | "revisar" | "info";
  enviar: any;
  refresh?: () => void;
  userId: string;
  onRecusar?: (id: string) => Promise<void>;
  onProposalSent?: (data: { orcamentoId: string; proposta: any; orcamento: any }) => void;
  disableChat?: boolean;
  minhaProposta?: any;
  materiaisCat?: any[];
  propostaMateriais?: any[];
  minhaAgenda?: any;
}

export function OrcamentoCard(props: OrcamentoCardProps) {
  const {
    o,
    cliente,
    clienteCidade,
    distanciaKm: distKm,
    range,
    materiais,
    mode,
    enviar,
    refresh,
    userId,
    onRecusar,
    onProposalSent,
    disableChat = false,
    minhaProposta,
    materiaisCat,
    propostaMateriais,
    minhaAgenda,
  } = props;

  const agendaResult = minhaAgenda ? isAgendaCompativel(o, minhaAgenda) : null;
  const isOportunidade = !minhaProposta && mode === "pegar";
  const isEnviado = !!minhaProposta && minhaProposta.status === "pendente";
  const [editing, setEditing] = useState(isOportunidade);
  
  const initialValor = minhaProposta?.valor_servico ?? o.valor_servico ?? o.valor ?? null;
  const [valor, setValor] = useState(
    initialValor != null ? String(initialValor).replace(".", ",") : "",
  );
  const [obs, setObs] = useState(minhaProposta?.observacoes ?? o.observacoes_profissional ?? "");
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>(() => {
    if (propostaMateriais && propostaMateriais.length > 0) {
      const init: Record<string, number> = {};
      propostaMateriais.forEach((pm) => (init[pm.material_id] = pm.quantidade));
      return init;
    } else if (materiais && materiais.length > 0 && !minhaProposta) {
      const init: Record<string, number> = {};
      materiais.forEach((m: any) => (init[m.material_id!] = m.quantidade));
      return init;
    }
    return {};
  });
  const [fotosConcluido, setFotosConcluido] = useState<string[]>(o.fotos_concluido ?? []);
  const [showDetails, setShowDetails] = useState(false);

  const isAguardandoPagamento = o.status === "aprovado";
  const isPagamentoConfirmado = o.status === "pago";
  const isServicoConcluido = o.status === "concluido";

  const meta = STATUS_META[o.status];
  
  const statusLabelOverride =
    isAguardandoPagamento
      ? "Aguardando pagamento"
      : isPagamentoConfirmado
        ? "Agenda confirmada"
        : meta?.label ?? o.status;

  const statusClassOverride =
    isAguardandoPagamento
      ? "bg-amber-100 text-amber-700"
      : isPagamentoConfirmado
        ? "bg-emerald-100 text-emerald-700"
        : meta?.className ?? "bg-slate-100 text-slate-600";
  const min = range?.preco_min != null ? Number(range.preco_min) : null;
  const max = range?.preco_max != null ? Number(range.preco_max) : null;

  const tipoAtendimentoLabel =
    (o as any).tipo_atendimento === "mulher"
      ? "Profissional mulher"
      : (o as any).tipo_atendimento === "homem"
        ? "Profissional homem"
        : (o as any).tipo_atendimento === "homem_com_apoio_feminino"
          ? "Profissional + apoio feminino"
          : "Não informado";

  const periodoLabel =
    o.periodo_preferido === "manha"
      ? "Manhã"
      : o.periodo_preferido === "tarde"
        ? "Tarde"
        : o.periodo_preferido === "noite"
          ? "Noite"
          : o.periodo_preferido === "horario_especifico"
            ? o.horario_preferido?.slice(0, 5) || "Horário específico"
            : "A combinar";

  const agendaLabel = o.data_preferida
    ? `${new Date(o.data_preferida + "T00:00:00").toLocaleDateString("pt-BR")} · ${periodoLabel}`
    : "A combinar";

  const handleEnviar = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (isNaN(v) || v < 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (min != null && max != null && (v < min || v > max)) {
      toast.error(`Valor fora do range tabelado (R$ ${min.toFixed(2)} – R$ ${max.toFixed(2)})`);
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sua sessão expirou. Por favor, faça login novamente.");
      }

      // Use the server function to create a proposal
      const mats = Object.entries(picked).map(([id, qty]) => ({ materialId: id, quantidade: qty }));
      const res = await enviar({
        data: {
          orcamentoId: o.id,
          valorServico: v,
          observacoes: obs.trim() || undefined,
          materiais: mats,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      const finalStatus = res?.orcamento?.status || "enviado";
      toast.success(`Proposta enviada! Status do pedido: ${finalStatus}`);
      
      if (onProposalSent && res?.proposta && res?.orcamento) {
        onProposalSent({
          orcamentoId: o.id,
          proposta: res.proposta,
          orcamento: res.orcamento
        });
      }

      if (mode === "revisar") setEditing(false);
      refresh?.();
    } catch (e: any) {
      console.error("Erro ao enviar proposta:", e);
      toast.error("Falha ao enviar", { 
        description: e?.message || "Ocorreu um erro inesperado." 
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePegar = async () => {
    setSaving(true);
    const { data } = await supabase
      .from("orcamentos")
      .select("profissional_id")
      .eq("id", o.id)
      .single();
    if (data?.profissional_id) {
      toast.error("Poxa! Outro profissional pegou esse pedido 1 segundo antes de você.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("orcamentos")
      .update({ profissional_id: userId })
      .eq("id", o.id)
      .is("profissional_id", null);

    if (error) {
      toast.error("Erro ao pegar pedido", { description: error.message });
    } else {
      toast.success("Boa! Pedido reservado para você. Agora elabore o orçamento.");
      refresh?.();
    }
    setSaving(false);
  };

  const handleConcluir = async () => {
    if (fotosConcluido.length === 0) {
      if (
        !confirm(
          "Marcar como concluído sem anexar fotos do serviço pronto? Recomendamos pelo menos 1 foto.",
        )
      )
        return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("orcamentos")
      .update({ status: "concluido" as any, fotos_concluido: fotosConcluido })
      .eq("id", o.id);
    if (error) {
      toast.error("Erro ao concluir", { description: error.message });
    } else {
      toast.success("Serviço concluído! O cliente receberá pedido de avaliação.");
      refresh?.();
    }
    setSaving(false);
  };

  const slaHoras = o.status === "customizado_pendente" ? 4 : o.status === "enviado" ? 24 : null;

  let isUrgent = false;
  if (o.status === "customizado_pendente") {
    const hoursSinceCreated =
      (new Date().getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreated >= 2) isUrgent = true;
  }

  const isHighlighted =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("orcamentoId") === o.id;

  return (
    <div
      id={`orc-${o.id}`}
      className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden transition-all ${isHighlighted ? "border-brand ring-2 ring-brand/30 shadow-lg" : isUrgent ? "border-red-200 shadow-red-50" : "border-border"}`}
    >
      {isUrgent && <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold truncate text-slate-900">{o.service_name}</h3>
          <p
            className={`text-xs mt-0.5 font-medium ${isUrgent ? "text-red-500" : "text-muted-foreground"}`}
          >
            Solicitado em{" "}
            {new Date(o.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap uppercase tracking-wider ${statusClassOverride}`}
          >
            {statusLabelOverride}
          </span>
          {slaHoras && <SLABadge createdAt={o.created_at} prazoHoras={slaHoras} />}
        </div>
      </div>

      <div className="text-sm space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate">{cliente?.nome || "Cliente"}</span>
          {(clienteCidade || distKm != null) && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {clienteCidade}
              {distKm != null && ` · ${distKm.toFixed(1)} km`}
            </span>
          )}
        </div>
        {isAguardandoPagamento && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <Clock className="h-4 w-4" />
              Reserva pendente
            </div>
            <p className="text-amber-700 text-xs leading-relaxed">
              A cliente aceitou sua proposta. Assim que o pagamento for confirmado, este serviço entra na sua agenda.
            </p>
          </div>
        )}

        {isPagamentoConfirmado && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Agenda confirmada
            </div>
            <p className="text-emerald-700 text-xs leading-relaxed">
              Pagamento confirmado. Este serviço já pode ser considerado compromisso ativo em sua agenda para {agendaLabel}.
            </p>
          </div>
        )}

        {showDetails && (
          <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Tipo de Atendimento</p>
                <p className="font-medium text-slate-700">{tipoAtendimentoLabel}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Agenda Desejada</p>
                <p className="font-medium text-slate-700">{agendaLabel}</p>
              </div>
              {o.descricao && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Descrição</p>
                  <p className="text-slate-600 leading-relaxed">{o.descricao}</p>
                </div>
              )}
              {materiais.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Materiais Planejados</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {materiais.map((m, idx) => (
                      <span key={idx} className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-600">
                        {m.quantidade}x {m.nome_snapshot}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {o.observacoes_profissional && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Minhas Observações</p>
                  <p className="text-slate-600 italic">"{o.observacoes_profissional}"</p>
                </div>
              )}
              {o.fotos_problema && o.fotos_problema.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Anexos do Cliente</p>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {o.fotos_problema.map((u) => {
                      const isVideo = u.toLowerCase().match(/\.(mp4|mov|webm)$/);
                      return (
                        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="group relative">
                          {isVideo ? (
                            <div className="h-16 w-24 rounded-lg bg-slate-200 flex flex-col items-center justify-center border border-border group-hover:bg-slate-300 transition-colors">
                              <Camera className="h-5 w-5 text-slate-500" />
                              <span className="text-[8px] font-bold text-slate-600 mt-1">VER VÍDEO</span>
                            </div>
                          ) : (
                            <img
                              src={u}
                              alt="Anexo"
                              className="h-16 w-16 rounded-lg object-cover border border-border group-hover:opacity-90 transition"
                            />
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100 mt-auto">
        {!editing ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-0.5">
                Investimento
              </p>
              <p className="text-xl font-black text-slate-800">
                {initialValor != null ? `R$ ${Number(initialValor).toFixed(2)}` : "A definir"}
              </p>
            </div>
            <div className="flex gap-2">
              {mode === "pegar" && (
                <>
                  <Button
                    onClick={handlePegar}
                    disabled={saving}
                    className="rounded-full bg-brand hover:bg-brand/90 text-white font-bold px-6 shadow-md"
                  >
                    {saving ? "Processando…" : "Pegar Pedido"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 font-bold text-xs"
                    onClick={() => onRecusar?.(o.id)}
                  >
                    Recusar
                  </Button>
                </>
              )}
              {mode === "revisar" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full font-bold"
                  onClick={() => setEditing(true)}
                >
                  Editar Orçamento
                </Button>
              )}
              {mode === "info" && (
                <Button
                  variant="outline"
                  size="sm"
                  className={`rounded-full font-bold h-10 px-6 ${showDetails ? "bg-slate-100" : ""}`}
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? "Ocultar Detalhes" : "Ver Detalhes"}
                </Button>
              )}

              {o.status === "pago" && (
                <div className="w-full space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Evidências da conclusão
                    </p>
                    <PhotoUploader
                      userId={userId}
                      pathPrefix={`concluidos/${o.id}`}
                      value={fotosConcluido}
                      onChange={setFotosConcluido}
                    />
                  </div>
                  <Button
                    onClick={handleConcluir}
                    disabled={saving}
                    className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11"
                  >
                    Finalizar Serviço
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                  Valor da Mão de Obra
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">
                    R$
                  </span>
                  <input
                    type="text"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-slate-50 focus:ring-2 focus:ring-brand/20 outline-none text-sm font-bold"
                  />
                </div>
                {min != null && max != null && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Tabela: R$ {min.toFixed(0)} – {max.toFixed(0)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                  Observações para o cliente
                </label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={1}
                  placeholder="Ex: Incluso material básico..."
                  className="w-full p-2.5 rounded-xl border border-border bg-slate-50 focus:ring-2 focus:ring-brand/20 outline-none text-sm min-h-[45px] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleEnviar}
                disabled={saving}
                className="flex-1 rounded-full bg-brand hover:bg-brand/90 text-white font-bold h-11 shadow-lg"
              >
                {saving ? "Enviando…" : "Enviar Orçamento"}
              </Button>
              {mode === "revisar" && (
                <Button variant="ghost" onClick={() => setEditing(false)} className="rounded-full">
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
