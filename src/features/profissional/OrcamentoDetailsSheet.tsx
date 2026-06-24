import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OrcamentoCard } from "./OrcamentoCard";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import {
  Orcamento,
  Profile,
  ServicoCat,
  OrcMat,
  ClienteGeo,
} from "./types";

export type SheetMode = "pegar" | "enviar" | "revisar" | "info";

interface OrcamentoDetailsSheetProps {
  orcamento: Orcamento | null;
  onClose: () => void;
  cliente: Profile | undefined;
  clienteCidade: string | null;
  range: ServicoCat | undefined;
  materiais: OrcMat[];
  mode: SheetMode;
  enviar: any;
  onProposalSent: (data: {
    orcamentoId: string;
    proposta: any;
    orcamento: any;
  }) => void;
  refresh: () => void;
  userId: string;
  onRecusar: (id: string) => Promise<void>;
  propostaMateriais: any[];
  minhaAgenda: any;
  profGenero: string | null;
  profApoioFeminino: boolean;
  clienteEndereco?: any;
}

const catalogNameKey = (name: string | null | undefined) =>
  `name:${String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()}`;

/**
 * Painel lateral (Sheet) com os detalhes de um orçamento selecionado.
 * Extraído do route file para isolar a árvore do Sheet.
 */
export function OrcamentoDetailsSheet({
  orcamento,
  onClose,
  cliente,
  clienteCidade,
  range,
  materiais,
  mode,
  enviar,
  onProposalSent,
  refresh,
  userId,
  onRecusar,
  propostaMateriais,
  minhaAgenda,
  profGenero,
  profApoioFeminino,
  clienteEndereco,
}: OrcamentoDetailsSheetProps) {
  const [disputaOpen, setDisputaOpen] = useState(false);
  const [disputaMotivo, setDisputaMotivo] = useState("");
  const [disputaLoading, setDisputaLoading] = useState(false);
  const [apoioNome, setApoioNome] = useState<string | null>(null);

  const isApoioFeminino = (orcamento as unknown as Record<string, unknown>)?.tipo_atendimento === "homem_com_apoio_feminino";
  const apoioEquipeId = (orcamento as unknown as Record<string, unknown>)?.apoio_equipe_id as string | undefined;

  useEffect(() => {
    if (!isApoioFeminino || !apoioEquipeId) {
      setApoioNome(null);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("apoio_feminino_equipe")
        .select("nome")
        .eq("id", apoioEquipeId)
        .maybeSingle();
      if (active && data) setApoioNome(data.nome);
    })();
    return () => { active = false; };
  }, [isApoioFeminino, apoioEquipeId]);

  const handleAbrirDisputa = async () => {
    if (!orcamento?.id) return;
    const motivo = disputaMotivo.trim();
    if (!motivo) {
      toast.error("Descreva o problema antes de abrir a disputa.");
      return;
    }
    setDisputaLoading(true);
    try {
      const { error } = await supabase.rpc("abrir_disputa_orcamento", {
        _orcamento_id: orcamento.id,
        _motivo: motivo,
      });
      if (error) throw error;
      toast.success("Disputa aberta — nossa equipe vai mediar");
      setDisputaOpen(false);
      setDisputaMotivo("");
      refresh();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao abrir disputa");
    } finally {
      setDisputaLoading(false);
    }
  };

  return (
    <Sheet
      open={!!orcamento}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
        aria-describedby={undefined}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border bg-slate-50">
          <SheetTitle className="text-lg font-bold">
            {orcamento?.service_name ?? "Pedido"}
          </SheetTitle>
        </SheetHeader>
        <div className="p-6">
          {orcamento && (
            <OrcamentoCard
              key={orcamento.id + "-sheet"}
              o={orcamento}
              cliente={cliente}
              clienteCidade={clienteCidade}
              distanciaKm={null}
              range={range}
              materiais={materiais}
              mode={mode}
              enviar={enviar}
              onProposalSent={onProposalSent}
              refresh={() => {
                refresh();
                onClose();
              }}
              userId={userId}
              onRecusar={async (id) => {
                await onRecusar(id);
                onClose();
              }}
              propostaMateriais={propostaMateriais}
              minhaAgenda={minhaAgenda}
              profGenero={profGenero}
              profApoioFeminino={profApoioFeminino}
              clienteEndereco={clienteEndereco}
              disableChat
            />
          )}

          {orcamento && isApoioFeminino && (
            <div className="mt-6 p-4 rounded-xl bg-purple-50 border border-purple-100 space-y-2">
              <p className="text-sm font-bold text-purple-800 flex items-center gap-2">
                👩 Com apoio feminino
              </p>
              <p className="text-xs text-purple-700 leading-relaxed">
                Este serviço inclui apoio feminino. Uma mulher de apoio acompanhará a visita, designada pela equipe Marido pra Quê.
              </p>
              <p className="text-xs font-bold text-purple-900">
                {apoioEquipeId && apoioNome
                  ? `Acompanhante: ${apoioNome}`
                  : "Acompanhante será designada antes da visita."}
              </p>
            </div>
          )}

          {orcamento && (orcamento.status === "pago" || orcamento.status === "concluido") && (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <Button
                variant="destructive"
                className="w-full font-bold"
                onClick={() => setDisputaOpen(true)}
              >
                Reportar problema
              </Button>
            </div>
          )}

          {orcamento?.status === "em_disputa" && (
            <div className="mt-6 p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-slate-500" />
              <p className="text-sm font-bold text-slate-700">Disputa em análise pela equipe</p>
            </div>
          )}
        </div>
      </SheetContent>

      <Dialog open={disputaOpen} onOpenChange={setDisputaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reportar problema</DialogTitle>
            <DialogDescription>
              Descreva detalhadamente o problema com este serviço. Nossa equipe fará a mediação e entrará em contato.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Descreva o motivo da disputa..."
              value={disputaMotivo}
              onChange={(e) => setDisputaMotivo(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputaOpen(false)} disabled={disputaLoading}>
              Cancelar
            </Button>
            <Button onClick={handleAbrirDisputa} disabled={disputaLoading} variant="destructive">
              {disputaLoading ? "Abrindo..." : "Abrir Disputa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
