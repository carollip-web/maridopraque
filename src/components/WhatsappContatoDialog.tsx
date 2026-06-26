import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { registrarContatoManual } from "@/lib/admin-contato-log.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function WhatsappContatoDialog({
  open,
  onOpenChange,
  destinatarioUserId,
  destinatarioEmail,
  telefone,
  nome,
  mensagemSugerida,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  destinatarioUserId?: string | null;
  destinatarioEmail?: string | null;
  telefone: string;
  nome?: string | null;
  mensagemSugerida?: string;
  onRegistered?: () => void;
}) {
  const registrar = useServerFn(registrarContatoManual);
  const [assunto, setAssunto] = useState("");
  const [observacao, setObservacao] = useState(mensagemSugerida ?? "");
  const [saving, setSaving] = useState(false);

  const numero = telefone.replace(/\D/g, "");
  const numeroFinal = numero.length === 11 || numero.length === 10 ? `55${numero}` : numero;

  const submit = async (abrirWhats: boolean) => {
    if (!assunto.trim()) {
      toast.error("Informe um assunto para o contato.");
      return;
    }
    setSaving(true);
    try {
      const r: any = await registrar({
        data: {
          destinatario_user_id: destinatarioUserId ?? null,
          destinatario_email: destinatarioEmail ?? null,
          destinatario_telefone: telefone,
          canal: "whatsapp",
          assunto: assunto.trim(),
          observacao: observacao.trim() || null,
        },
      });
      if (!r?.ok) throw new Error(r?.error || "Falha ao registrar");
      toast.success("Contato registrado.");
      if (abrirWhats) {
        const url = `https://wa.me/${numeroFinal}?text=${encodeURIComponent(observacao || assunto)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      }
      onRegistered?.();
      onOpenChange(false);
      setAssunto("");
      setObservacao("");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao registrar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            Registrar contato no WhatsApp
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            Para <span className="font-medium text-slate-700">{nome || telefone}</span> ({telefone})
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Assunto *</label>
            <Input
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ex.: Cobrança de documentos, dúvida sobre cadastro..."
              maxLength={200}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Mensagem / observação
            </label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Texto que será aberto no WhatsApp e salvo como observação."
              rows={4}
              maxLength={2000}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => submit(false)} disabled={saving}>
            Apenas registrar
          </Button>
          <Button onClick={() => submit(true)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            Registrar e abrir WhatsApp <ExternalLink className="h-3.5 w-3.5 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
