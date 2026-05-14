import React from "react";
import { Wrench, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface ProfissionalStatusCardProps {
  userName: string;
  mediaAvaliacoes: string;
  ativo: boolean;
  handleToggleAtivo: (checked: boolean) => void;
}

export function ProfissionalStatusCard({
  userName,
  mediaAvaliacoes,
  ativo,
  handleToggleAtivo,
}: ProfissionalStatusCardProps) {
  return (
    <div className="bg-white rounded-3xl border border-border p-6 shadow-sm flex flex-col items-center text-center">
      <div className="h-16 w-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-4">
        <Wrench className="h-7 w-7" />
      </div>
      <div className="mb-6">
        <h3 className="font-bold text-slate-900 leading-tight">{userName}</h3>
        <div className="flex items-center justify-center gap-1.5 mt-1.5 text-amber-500 font-medium text-xs">
          <Star className="h-3.5 w-3.5 fill-amber-500" />
          <span>{mediaAvaliacoes} Avaliações</span>
        </div>
      </div>

      <div className="w-full pt-4 border-t border-border flex items-center justify-between">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${ativo ? "text-emerald-600" : "text-slate-400"}`}
        >
          {ativo ? "Online" : "Offline"}
        </span>
        <Switch
          checked={ativo}
          onCheckedChange={handleToggleAtivo}
          className="data-[state=checked]:bg-emerald-500"
        />
      </div>
    </div>
  );
}
