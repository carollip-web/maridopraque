import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { OrcamentoDraft, WizardStep } from "./types";

interface DraftSnapshot {
  selServiceId: string;
  descricao: string;
  tipoAtendimento: string;
  dataPreferida: string;
  periodoPreferido: string;
  horarioPreferido: string;
  flexibilidadeAgenda: string;
  picked: Record<string, number>;
  step: WizardStep;
}

/**
 * Persiste o rascunho do wizard em localStorage por usuário e
 * expõe ações para carregar/limpar. Auto-save desligado quando
 * está em modo edição.
 */
export function useOrcamentoDraft(args: {
  draftKey: string | null;
  showNew: boolean;
  editingId: string | null;
  snapshot: DraftSnapshot;
  apply: (d: OrcamentoDraft) => void;
}) {
  const { draftKey, showNew, editingId, snapshot, apply } = args;

  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  // Detecta rascunho existente no mount
  useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) setHasDraft(true);
    } catch {}
  }, [draftKey]);

  // Auto-save (debounced 500ms) enquanto o wizard está aberto em modo novo
  useEffect(() => {
    if (!draftKey || !showNew || editingId) return;
    if (typeof window === "undefined") return;
    if (
      !snapshot.selServiceId &&
      !snapshot.descricao &&
      Object.keys(snapshot.picked).length === 0
    )
      return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({ ...snapshot, savedAt: Date.now() }),
        );
        setDraftSavedAt(Date.now());
        setHasDraft(true);
      } catch {}
    }, 500);
    return () => window.clearTimeout(t);
  }, [draftKey, showNew, editingId, snapshot]);

  const carregarRascunho = useCallback(() => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as OrcamentoDraft;
      apply(d);
      toast.success("Rascunho restaurado.");
    } catch {
      toast.error("Não foi possível restaurar o rascunho.");
    }
  }, [draftKey, apply]);

  const limparRascunho = useCallback(() => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {}
    setHasDraft(false);
    setDraftSavedAt(null);
    toast.success("Rascunho descartado.");
  }, [draftKey]);

  const clearStored = useCallback(() => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {}
    setHasDraft(false);
    setDraftSavedAt(null);
  }, [draftKey]);

  return {
    hasDraft,
    draftSavedAt,
    carregarRascunho,
    limparRascunho,
    clearStored,
  };
}
