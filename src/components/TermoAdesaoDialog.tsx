import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileCheck2, Loader2, CheckCircle2 } from "lucide-react";
import { TERMO_VERSAO } from "./OnboardingWizard";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onAccepted: () => void;
};

export function TermoAdesaoDialog({ open, onOpenChange, userId, onAccepted }: Props) {
  const [aceito, setAceito] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAceitar = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profissional_perfil")
      .update({
        termo_aceito_em: new Date().toISOString(),
        termo_versao: TERMO_VERSAO,
      })
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao registrar aceite", { description: error.message });
      return;
    }
    toast.success("Termo aceito. Agora você pode aceitar pedidos.");
    onAccepted();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-full bg-brand/10 text-brand grid place-items-center">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <DialogTitle>Termo de Adesão e Responsabilidade</DialogTitle>
          </div>
          <DialogDescription>
            Para aceitar pedidos você precisa ler e aceitar nosso termo (versão {TERMO_VERSAO}).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-slate-50 p-4 text-xs text-slate-700 space-y-2 max-h-72 overflow-y-auto">
          <p>
            <strong>1. Autonomia.</strong> Atuo como prestador autônomo, sem vínculo empregatício
            com a plataforma. Sou responsável pelos meus tributos, INSS e demais obrigações fiscais.
          </p>
          <p>
            <strong>2. Capacitação.</strong> Possuo conhecimento técnico, ferramentas e EPIs
            adequados para os serviços que aceitar.
          </p>
          <p>
            <strong>3. Responsabilidade integral.</strong> Sou inteira e exclusivamente responsável
            pela execução, qualidade, segurança e eventuais danos causados durante o serviço,
            isentando a plataforma de qualquer reparação a terceiros.
          </p>
          <p>
            <strong>4. Conduta.</strong> Comprometo-me com pontualidade, respeito, honestidade e
            sigilo das informações do cliente.
          </p>
          <p>
            <strong>5. Preço e pagamento.</strong> Aceito a tabela vigente da plataforma e o repasse
            na forma e prazos divulgados.
          </p>
          <p>
            <strong>6. Cancelamento.</strong> Posso recusar serviços, mas o cancelamento após aceite
            injustificado pode gerar penalidades.
          </p>
          <p>
            <strong>7. Dados.</strong> Autorizo o uso de meus dados de perfil, avaliações e
            histórico conforme LGPD.
          </p>
          <p>
            <strong>8. Validade.</strong> Este termo permanece válido enquanto eu mantiver cadastro
            ativo. Atualizações exigirão novo aceite.
          </p>
        </div>

        <label className="flex items-start gap-2 cursor-pointer p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <Checkbox
            checked={aceito}
            onCheckedChange={(v) => setAceito(v === true)}
            className="mt-0.5"
          />
          <span className="text-sm font-medium text-slate-900">
            Li, entendi e <strong>aceito integralmente</strong> os termos acima, assumindo total
            responsabilidade pelos serviços que prestar.
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Agora não
          </Button>
          <Button
            disabled={!aceito || saving}
            onClick={handleAceitar}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Aceitar e continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
