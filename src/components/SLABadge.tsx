import { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  createdAt: string;
  prazoHoras: number;
}

export function SLABadge({ createdAt, prazoHoras }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const created = new Date(createdAt).getTime();
  const deadline = created + prazoHoras * 3600_000;
  const restanteMs = deadline - now;
  const restanteMin = Math.round(restanteMs / 60_000);

  const formatar = (m: number) => {
    if (m <= 0) return "Atrasado";
    if (m < 60) return `${m} min restantes`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h${mm > 0 ? ` ${mm}m` : ""} restantes`;
  };

  const atrasado = restanteMin <= 0;
  const urgente = !atrasado && restanteMin <= 60;

  const cls = atrasado
    ? "bg-red-50 text-red-700 border-red-200"
    : urgente
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  const Icon = atrasado ? AlertTriangle : urgente ? Clock : CheckCircle2;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${cls}`}
    >
      <Icon className="h-3 w-3" />
      SLA · {formatar(restanteMin)}
    </span>
  );
}
