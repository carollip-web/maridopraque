import React, { useState } from "react";
import { User, MapPin, Camera } from "lucide-react";
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
  disableChat?: boolean;
  minhaProposta?: any;
  materiaisCat?: any[];
  propostaMateriais?: any[];
}

export function OrcamentoCard({
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
  disableChat = false,
  minhaProposta,
  materiaisCat,
  propostaMateriais,
}: OrcamentoCardProps) {
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

  const meta = STATUS_META[o.status];
  const min = range?.preco_min != null ? Number(range.preco_min) : null;
  const max = range?.preco_max != null ? Number(range.preco_max) : null;

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
      // Use the server function to create a proposal
      const mats = Object.entries(picked).map(([id, qty]) => ({ materialId: id, quantidade: qty }));
      await enviar({
        data: {
          orcamentoId: o.id,
          valorServico: v,
          observacoes: obs || null,
          materiais: mats,
        },
      });
      
      toast.success("Proposta enviada ao cliente!");
      if (mode === "revisar") setEditing(false);
      refresh?.();
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e?.message });
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
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap uppercase tracking-wider ${meta.className}`}
          >
            {meta.label}
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
        {o.descricao && (
          <p className="text-muted-foreground bg-slate-50 rounded-xl p-3 text-sm">{o.descricao}</p>
        )}
        {o.fotos_problema && o.fotos_problema.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {o.fotos_problema.map((u) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                <img
                  src={u}
                  alt="Foto do problema"
                  className="h-16 w-16 rounded-lg object-cover border border-border hover:opacity-90 transition"
                />
              </a>
            ))}
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
