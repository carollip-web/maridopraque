import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface DisputaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motivo: string;
  onMotivoChange: (motivo: string) => void;
  loading: boolean;
  onConfirm: () => void;
}

// Diálogo de abertura de disputa de um pedido. Estado e submit vivem no
// componente pai (PedidosTab); aqui é só a UI controlada.
export function DisputaDialog({
  open,
  onOpenChange,
  motivo,
  onMotivoChange,
  loading,
  onConfirm,
}: DisputaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir disputa</DialogTitle>
          <DialogDescription>
            Conte o que aconteceu para que nossa equipe analise o caso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-bold">Descreva o problema</label>
          <Textarea
            value={motivo}
            onChange={(e) => onMotivoChange(e.target.value)}
            placeholder="Ex.: o serviço não foi executado conforme combinado..."
            rows={5}
            required
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading || !motivo.trim()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Abrir disputa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
