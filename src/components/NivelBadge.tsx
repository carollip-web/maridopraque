import { calcularNivel } from "@/lib/nivel";
import { cn } from "@/lib/utils";

export function NivelBadge({ concluidos, notaMedia, compact = false }: { concluidos: number; notaMedia: number; compact?: boolean }) {
  const nivel = calcularNivel({ concluidos, notaMedia });
  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r", nivel.cor)}>
        {nivel.emoji} {nivel.nome}
      </span>
    );
  }
  return (
    <div className={cn("p-4 rounded-2xl bg-gradient-to-br shadow-sm", nivel.cor)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">Seu nível</p>
          <p className="text-2xl font-black mt-0.5">{nivel.emoji} {nivel.nome}</p>
        </div>
        <div className="text-right text-xs opacity-80">
          <p>{concluidos} serviços</p>
          <p className="font-semibold">⭐ {notaMedia.toFixed(1)}</p>
        </div>
      </div>
      {nivel.proximo && (
        <p className="text-[11px] mt-2 opacity-90">
          Próximo: <strong>{nivel.proximo.nome}</strong>
          {nivel.proximo.faltam.servicos ? ` · faltam ${nivel.proximo.faltam.servicos} serviços` : ""}
          {nivel.proximo.faltam.nota && nivel.proximo.faltam.nota > 0 ? ` · subir nota em ${nivel.proximo.faltam.nota.toFixed(1)}` : ""}
        </p>
      )}
    </div>
  );
}
