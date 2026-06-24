import React, { useState } from "react";
import {
  User,
  MapPin,
  Camera,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sunrise,
  Sun,
  Moon,
} from "lucide-react";
import { isAgendaCompativel } from "@/lib/agenda";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SLABadge } from "@/components/SLABadge";
import { PhotoUploader } from "@/components/PhotoUploader";
import { SignedImage, getOrcamentoFotoSignedUrl } from "@/components/SignedMedia";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Chat } from "@/components/Chat";
import { Orcamento, Profile, ServicoCat, OrcMat } from "./types";
import { STATUS_META } from "./constants";
import {
  isProfissionalCompativelComTipoAtendimento,
  compatibilityBadgeClass,
  tipoAtendimentoLabel,
} from "@/lib/atendimento.compat";

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
  onRecusar?: (id: string, motivo?: string | null) => Promise<void>;
  onProposalSent?: (data: { orcamentoId: string; proposta: any; orcamento: any }) => void;
  disableChat?: boolean;
  minhaProposta?: any;
  materiaisCat?: any[];
  propostaMateriais?: any[];
  minhaAgenda?: any;
  profGenero?: string | null;
  profApoioFeminino?: boolean;
  clienteEndereco?: any;
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
    profGenero,
    profApoioFeminino,
    clienteEndereco,
  } = props;

  const isApoioFemininoVacancy =
    profApoioFeminino &&
    o.tipo_atendimento === "homem_com_apoio_feminino" &&
    !(o as unknown as Record<string, unknown>).apoio_profissional_id;

  const agendaResult = minhaAgenda ? isAgendaCompativel(o, minhaAgenda) : null;
  const isOportunidade = !minhaProposta && mode === "pegar";
  const isEnviado = !!minhaProposta && minhaProposta.status === "pendente";
  const [editing, setEditing] = useState(isOportunidade && !isApoioFemininoVacancy);

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
  const [recusarOpen, setRecusarOpen] = useState(false);
  const [recusarMotivo, setRecusarMotivo] = useState<string>("");
  const [recusarMotivoOutro, setRecusarMotivoOutro] = useState<string>("");
  const [recusarLoading, setRecusarLoading] = useState(false);

  const MOTIVOS_RECUSA = [
    "Fora da minha área de atendimento",
    "Agenda incompatível",
    "Não é minha especialidade",
    "Valor abaixo do que aceito",
    "Outro",
  ];

  const handleConfirmRecusar = async () => {
    if (!onRecusar) return;
    const motivoFinal =
      recusarMotivo === "Outro" ? recusarMotivoOutro.trim() : recusarMotivo;
    setRecusarLoading(true);
    try {
      await onRecusar(o.id, motivoFinal || null);
      setRecusarOpen(false);
      setRecusarMotivo("");
      setRecusarMotivoOutro("");
    } finally {
      setRecusarLoading(false);
    }
  };

  const isAguardandoPagamento = o.status === "aprovado";
  const isPagamentoConfirmado = o.status === "pago";
  const isServicoConcluido = o.status === "concluido";
  const isEmDisputa = o.status === "em_disputa";
  const isDisputaResolvida = o.status === "disputa_resolvida";

  const meta = STATUS_META[o.status];

  const statusLabelOverride = isAguardandoPagamento
    ? "Aguardando pagamento"
    : isPagamentoConfirmado
      ? "Pagamento confirmado"
      : isServicoConcluido
        ? "Finalizado (Aguardando liberação)"
        : isEmDisputa
          ? "Em disputa"
          : isDisputaResolvida
            ? "Disputa resolvida"
            : (meta?.label ?? o.status);

  const statusClassOverride = isAguardandoPagamento
    ? "bg-amber-100 text-amber-700"
    : isPagamentoConfirmado
      ? "bg-blue-100 text-blue-700"
      : isServicoConcluido
        ? "bg-green-100 text-green-700"
        : isEmDisputa
          ? "bg-red-100 text-red-700"
          : isDisputaResolvida
            ? "bg-slate-200 text-slate-600"
            : (meta?.className ?? "bg-slate-100 text-slate-600");
  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const unitMin = range?.preco_min != null ? Number(range.preco_min) : null;
  const unitMax = range?.preco_max != null ? Number(range.preco_max) : null;
  const metragem = o.metragem_m2 != null ? Number(o.metragem_m2) : 0;
  const isM2 = metragem > 0 && /\(m²?\)|\bm2\b|metro quadrado/i.test(`${o.service_name} ${range?.nome ?? ""}`);
  const min = unitMin != null ? (isM2 ? unitMin * metragem : unitMin) : null;
  const max = unitMax != null ? (isM2 ? unitMax * metragem : unitMax) : null;


  const atendimentoCompat = isProfissionalCompativelComTipoAtendimento({
    tipoAtendimento: o.tipo_atendimento as import("@/lib/atendimento.compat").TipoAtendimento,
    genero: profGenero as "homem" | "mulher",
    ofereceApoioFeminino: profApoioFeminino,
  });

  const atendimentoPedidoLabel = tipoAtendimentoLabel((o as unknown as Record<string, unknown>).tipo_atendimento as import("@/lib/atendimento.compat").TipoAtendimento);

  const bloquearEnvioPorAtendimento =
    !atendimentoCompat.compatible && atendimentoCompat.blockProposal;

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
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

      const propostaNormalizada = res?.proposta ?? {
        id: `optimistic-${o.id}`,
        orcamento_id: o.id,
        profissional_id: userId,
        valor_servico: v,
        observacoes: obs.trim() || null,
        status: "pendente",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const orcamentoNormalizado = {
        ...o,
        ...(res?.orcamento ?? {}),
        id: o.id,
        status: res?.orcamento?.status ?? "enviado",
        profissional_id: res?.orcamento?.profissional_id ?? o.profissional_id ?? userId,
        valor_servico: res?.orcamento?.valor_servico ?? v,
        updated_at: new Date().toISOString(),
      };

      const finalStatus = orcamentoNormalizado.status;
      toast.success(`Proposta enviada! Status do pedido: ${finalStatus}`);

      onProposalSent?.({
        orcamentoId: o.id,
        proposta: propostaNormalizada,
        orcamento: orcamentoNormalizado,
      });

      if (mode === "revisar") setEditing(false);
    } catch (e: any) {
      console.error("Erro ao enviar proposta:", e);
      toast.error("Falha ao enviar", {
        description: e?.message || "Ocorreu um erro inesperado.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePegar = async () => {
    setSaving(true);
    
    if (isApoioFemininoVacancy) {
      const { data, error } = await supabase.rpc("assumir_vaga_apoio_feminino", {
        _orcamento_id: o.id,
      });

      if (error) {
        toast.error("Erro ao aceitar vaga", { description: error.message });
      } else if (data && (data as unknown as Record<string, unknown>).ok === false) {
        toast.error(
          ((data as unknown as Record<string, unknown>).erro as string) ||
            "Poxa! Outra profissional aceitou esta vaga 1 segundo antes de você.",
        );
      } else {
        toast.success("Boa! Você confirmou presença neste serviço como Apoio Feminino.");
        refresh?.();
      }
      setSaving(false);
      return;
    }

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
      if (!confirm("Salvar sem anexar fotos do serviço pronto? Recomendamos pelo menos 1 foto."))
        return;
    }
    setSaving(true);
    try {
      // 1. Salvar as fotos primeiro
      const { error: photoErr } = await supabase
        .from("orcamentos")
        .update({ fotos_concluido: fotosConcluido })
        .eq("id", o.id);

      if (photoErr) throw photoErr;

      // 2. Chamar mp-capturar-pagamento com ator: 'profissional'
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Por favor, faça login novamente.");

      const { data, error } = await supabase.functions.invoke("mp-capturar-pagamento", {
        body: { orcamento_id: o.id, ator: "profissional" },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data?.ok) {
        if (data?.message?.includes("parcial")) {
          // It's expected to be partial since the client hasn't confirmed yet
          toast.success("Aguardando confirmação do cliente para liberar o débito e o repasse");
        } else {
          throw new Error(data?.message || "Erro ao registrar confirmação do serviço.");
        }
      } else {
        // Se por algum motivo capturar de vez (ex: cliente confirmou antes)
        toast.success("Aguardando confirmação do cliente para liberar o débito e o repasse");
      }

      refresh?.();
    } catch (e: any) {
      toast.error("Falha ao marcar como concluído", { description: e.message });
    } finally {
      setSaving(false);
    }
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

  const reserva = minhaAgenda?.bloqueiosAgenda?.find((b: any) => b.orcamento_id === o.id);
  const isReservaTemporaria = reserva?.status === "temporario";
  const isReservaConfirmada = reserva?.status === "confirmado";

  const agendaLabel = o.data_preferida
    ? `${new Date(o.data_preferida + "T00:00:00").toLocaleDateString("pt-BR")} · ${periodoLabel}`
    : "A combinar";

  if (mode === "info" && showDetails) {
    console.info("[OrcamentoCard] detalhes recebidos", {
      id: o.id,
      tipo_atendimento: o.tipo_atendimento,
      data_preferida: o.data_preferida,
      periodo_preferido: o.periodo_preferido,
      horario_preferido: o.horario_preferido,
      reserva,
      minhaAgenda: !!minhaAgenda,
    });
  }

  const isVideo = (url: string) => /\.(mp4|mov|webm|m4v)$/i.test(url.split("?")[0] || "");

  return (
    <div
      id={`orc-${o.id}`}
      className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden transition-all ${isHighlighted ? "border-brand ring-2 ring-brand/30 shadow-lg" : isUrgent ? "border-red-200 shadow-red-50" : "border-border"}`}
    >
      {isUrgent && <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold truncate text-slate-900">{o.service_name}</h3>
          {o.metragem_m2 != null && Number(o.metragem_m2) > 0 && (
            <p className="text-[11px] mt-0.5 font-bold text-brand">
              Área informada: {Number(o.metragem_m2)} m²
              {range?.preco_min != null && range?.preco_max != null && (
                <span className="font-medium text-slate-500">
                  {" "}· R$ {Number(range.preco_min).toFixed(2)}–{Number(range.preco_max).toFixed(2)}/m²
                </span>
              )}
            </p>
          )}
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

        {min != null && max != null && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
              Faixa estimada da mão de obra
            </p>
            <p className="mt-1 text-base font-bold text-slate-900 tabular-nums">
              {formatCurrency(min)} – {formatCurrency(max)}
            </p>
            {isM2 && unitMin != null && unitMax != null && (
              <p className="mt-0.5 text-[11px] font-medium text-amber-700">
                {metragem} m² × {formatCurrency(unitMin)}–{formatCurrency(unitMax)}/m²
              </p>
            )}
          </div>
        )}

        {o.tipo_atendimento && (
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${compatibilityBadgeClass(
              atendimentoCompat.level,
            )}`}
          >
            {atendimentoCompat.label}
          </span>
          {o.tipo_atendimento === "homem_com_apoio_feminino" && (
            <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 border border-purple-100">
              👩 Com apoio feminino
            </span>
          )}
        </div>
      )}


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
        {!(isPagamentoConfirmado || isServicoConcluido) && (() => {
          const end = (o as unknown as Record<string, any>).endereco_snapshot || clienteEndereco;
          if (!end || (!end.bairro && !end.logradouro)) return null;
          return (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                {end.logradouro}
                {end.bairro && (end.logradouro ? ` · ${end.bairro}` : end.bairro)}
                <span className="ml-1 italic text-[10px] opacity-70">
                  (endereço completo após o pagamento)
                </span>
              </span>
            </div>
          );
        })()}

        {/* Resumo compacto Atendimento/Agenda (Sempre visível) */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 rounded-2xl bg-slate-50 p-4 border border-slate-100/50">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Atendimento
            </p>
            <p className="text-sm font-bold text-slate-800">{atendimentoPedidoLabel}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Agenda desejada
            </p>
            <p className="text-sm font-bold text-slate-800">{agendaLabel}</p>
          </div>
        </div>

        {!o.tipo_atendimento && !o.data_preferida && (
          <p className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 italic">
            Este pedido foi criado sem preferências de atendimento ou agenda registradas.
          </p>
        )}

        {isEmDisputa && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 space-y-2">
            <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
              <AlertCircle className="h-4 w-4" />
              Disputa Aberta
            </div>
            <p className="text-red-700 text-[11px] leading-relaxed">
              <strong>Motivo:</strong> {o.observacoes_profissional || "Nenhum motivo fornecido."}
            </p>
          </div>
        )}

        {isAguardandoPagamento && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <Clock className="h-4 w-4" />
              {isReservaTemporaria ? "Reserva temporária ativa" : "Reserva pendente"}
            </div>
            <p className="text-amber-700 text-[11px] leading-relaxed">
              {isReservaTemporaria
                ? `Este horário (${agendaLabel}) está bloqueado na sua agenda por 2h aguardando o pagamento.`
                : "A cliente aceitou sua proposta. Assim que o pagamento for confirmado, este serviço entra na sua agenda."}
            </p>
            {isReservaTemporaria && reserva.expires_at && (
              <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                Expira às{" "}
                {new Date(reserva.expires_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
            {!isReservaTemporaria && o.data_preferida && (
              <p className="text-[10px] text-amber-600 font-bold italic mt-1">
                Não foi possível reservar automaticamente. Combine o horário pelo chat.
              </p>
            )}
          </div>
        )}

        {isPagamentoConfirmado && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-2">
            <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Pagamento confirmado
            </div>
            <p className="text-blue-700 text-[11px] leading-relaxed">
              Pagamento confirmado — serviço reservado na sua agenda.
            </p>
          </div>
        )}

        {isServicoConcluido && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-100 space-y-2">
            <div className="flex items-center gap-2 text-green-800 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Serviço Finalizado
            </div>
            <p className="text-green-700 text-[11px] leading-relaxed">
              O cliente marcou o serviço como concluído. O repasse está em processamento e será
              liberado em breve.
            </p>
          </div>
        )}

        {(isPagamentoConfirmado || isServicoConcluido) && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 mt-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <MapPin className="h-4 w-4" />
              Endereço de atendimento
            </div>
            {(() => {
              const enderecoToShow = (o as unknown as Record<string, unknown>).endereco_snapshot || clienteEndereco;
              return enderecoToShow ? (
              <div className="text-xs text-slate-600 leading-relaxed space-y-1">
                <p>
                  {enderecoToShow.logradouro}, {enderecoToShow.numero}
                  {enderecoToShow.complemento && ` - ${enderecoToShow.complemento}`}
                </p>
                <p>
                  {enderecoToShow.bairro}, {enderecoToShow.cidade} - {enderecoToShow.uf}
                </p>
                <p>CEP: {enderecoToShow.cep}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${enderecoToShow.logradouro}, ${enderecoToShow.numero}, ${enderecoToShow.bairro}, ${enderecoToShow.cidade} - ${enderecoToShow.uf}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-brand font-bold hover:underline"
                >
                  Abrir no mapa ↗
                </a>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Endereço não informado — combine pelo chat
              </p>
            );
            })()}
          </div>
        )}

        {bloquearEnvioPorAtendimento && (
          <div className="mt-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-bold">{atendimentoCompat.label}</p>
            <p className="mt-1 text-[11px] leading-relaxed">
              {atendimentoCompat.reason ||
                "Este pedido exige um tipo de atendimento incompatível com seu perfil."}
            </p>
          </div>
        )}

        {showDetails && (
          <div className="space-y-4 p-4 rounded-xl bg-slate-50/80 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300 shadow-inner">
            <div className="grid gap-4 text-xs">
              {o.descricao && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    Descrição do Pedido
                  </p>
                  <p className="text-slate-700 leading-relaxed bg-white/50 p-3 rounded-lg border border-slate-100">
                    {o.descricao}
                  </p>
                </div>
              )}

              {/* Materiais: Usa propostaMateriais se existir, senão materiais do orçamento */}
              {(propostaMateriais?.length || materiais.length > 0) && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
                    Materiais
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(propostaMateriais?.length ? propostaMateriais : materiais).map(
                      (m: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium flex items-center gap-1.5 shadow-sm"
                        >
                          <span className="text-brand font-bold">{m.quantidade}x</span>{" "}
                          {m.nome_snapshot || m.nome}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Observações da proposta ou profissional */}
              {(obs || o.observacoes_profissional) && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    Observações enviadas
                  </p>
                  <p className="text-slate-600 italic bg-white/50 p-3 rounded-lg border border-slate-100">
                    "{obs || o.observacoes_profissional}"
                  </p>
                </div>
              )}

              {o.fotos_problema && o.fotos_problema.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
                    Anexos do Cliente
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {o.fotos_problema.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={async () => {
                          const signed = await getOrcamentoFotoSignedUrl(u);
                          window.open(signed, "_blank", "noopener,noreferrer");
                        }}
                        className="group relative"
                      >
                        {isVideo(u) ? (
                          <div className="h-16 w-24 rounded-lg bg-slate-200 flex flex-col items-center justify-center border border-border group-hover:bg-slate-300 transition-colors">
                            <Camera className="h-5 w-5 text-slate-500" />
                            <span className="text-[8px] font-bold text-slate-600 mt-1">
                              VER VÍDEO
                            </span>
                          </div>
                        ) : (
                          <SignedImage
                            src={u}
                            alt="Anexo"
                            className="h-16 w-16 rounded-lg object-cover border border-border group-hover:opacity-90 transition shadow-sm"
                          />
                        )}
                      </button>
                    ))}
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
                {profApoioFeminino 
                  ? ((o as unknown as Record<string, unknown>).valor_apoio_feminino ? `R$ ${Number((o as unknown as Record<string, unknown>).valor_apoio_feminino).toFixed(2)}` : "A definir")
                  : (initialValor != null ? `R$ ${Number(initialValor).toFixed(2)}` : "A definir")}
              </p>
            </div>
            <div className="flex gap-2">
              {mode === "pegar" && (
                <>
                  <Button
                    onClick={handlePegar}
                    disabled={saving || bloquearEnvioPorAtendimento}
                    className="rounded-full bg-brand hover:bg-brand/90 text-white font-bold px-6 shadow-md"
                  >
                    {saving ? "Processando…" : isApoioFemininoVacancy ? "Aceitar Vaga" : "Pegar Pedido"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 font-bold text-xs"
                    onClick={() => setRecusarOpen(true)}
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
              <Button
                variant="outline"
                size="sm"
                className={`rounded-full font-bold h-10 px-6 ${showDetails ? "bg-slate-100" : ""}`}
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? "Ocultar Detalhes" : "Ver Detalhes"}
              </Button>

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
                    {saving ? "Processando..." : "Marcar como concluído"}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Para o repasse ser liberado, o cliente precisa confirmar a conclusão do serviço
                    no app dele.
                  </p>
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
                    Faixa do cliente: <span className="font-bold text-foreground not-italic">{formatCurrency(min)} – {formatCurrency(max)}</span>
                    {isM2 && unitMin != null && unitMax != null && (
                      <> ({metragem} m² × {formatCurrency(unitMin)}–{formatCurrency(unitMax)}/m²)</>
                    )}
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
                disabled={saving || bloquearEnvioPorAtendimento}
                className="flex-1 rounded-full bg-brand hover:bg-brand/90 text-white font-bold h-11 shadow-lg"
              >
                {saving ? "Enviando…" : "Enviar Orçamento"}
              </Button>
              {mode === "pegar" && onRecusar && (
                <Button
                  variant="outline"
                  onClick={() => setRecusarOpen(true)}
                  className="rounded-full h-11 px-5 font-bold text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  Recusar
                </Button>
              )}
              {mode === "revisar" && (
                <Button variant="ghost" onClick={() => setEditing(false)} className="rounded-full">
                  Cancelar
                </Button>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Chat Section for Paid or Completed Orders */}
      {!disableChat && (isPagamentoConfirmado || isServicoConcluido) && !editing && (
        <div className="pt-4 border-t border-slate-100">
          <Chat
            orcamentoId={o.id}
            contraparteId={o.cliente_id}
            contraparteNome={cliente?.nome || "Cliente"}
          />
        </div>
      )}

      <Dialog open={recusarOpen} onOpenChange={(open) => !recusarLoading && setRecusarOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar este pedido?</DialogTitle>
            <DialogDescription>
              Ele sairá do seu radar. Conte por que recusou — nos ajuda a melhorar o que chega até você (opcional).
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            {MOTIVOS_RECUSA.map((m) => (
              <label
                key={m}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  recusarMotivo === m
                    ? "border-brand bg-brand-soft"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="motivo-recusa"
                  value={m}
                  checked={recusarMotivo === m}
                  onChange={() => setRecusarMotivo(m)}
                  className="accent-brand"
                />
                <span className="text-sm font-medium">{m}</span>
              </label>
            ))}
            {recusarMotivo === "Outro" && (
              <Textarea
                placeholder="Descreva o motivo..."
                value={recusarMotivoOutro}
                onChange={(e) => setRecusarMotivoOutro(e.target.value)}
                rows={3}
                className="resize-none mt-2"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRecusarOpen(false)}
              disabled={recusarLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRecusar}
              disabled={
                recusarLoading ||
                (recusarMotivo === "Outro" && !recusarMotivoOutro.trim())
              }
            >
              {recusarLoading ? "Recusando..." : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

