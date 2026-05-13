import { useEffect, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { carregarAgendaProfissional, slotsDoDia } from "@/lib/agenda";

interface SlotPickerProps {
  profissionalId: string;
  value?: Date | null;
  onChange: (date: Date) => void;
}

export function SlotPicker({ profissionalId, value, onChange }: SlotPickerProps) {
  const [data, setData] = useState<Date | undefined>(value ?? undefined);
  const [loading, setLoading] = useState(true);
  const [agenda, setAgenda] = useState<Awaited<
    ReturnType<typeof carregarAgendaProfissional>
  > | null>(null);

  useEffect(() => {
    setLoading(true);
    carregarAgendaProfissional(profissionalId).then((a) => {
      setAgenda(a);
      setLoading(false);
    });
  }, [profissionalId]);

  const slots = useMemo(() => {
    if (!data || !agenda) return [];
    return slotsDoDia({ data, ...agenda });
  }, [data, agenda]);

  if (loading) {
    return (
      <div className="py-8 grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!agenda || agenda.janelas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Este profissional ainda não cadastrou horários disponíveis.
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-border bg-white p-2">
        <Calendar
          mode="single"
          selected={data}
          onSelect={setData}
          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
          className={cn("p-3 pointer-events-auto")}
        />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-700 mb-2">
          {data ? `Horários em ${data.toLocaleDateString("pt-BR")}` : "Selecione uma data"}
        </p>
        {data && slots.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum horário disponível neste dia.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => {
              const sel = value && s.getTime() === new Date(value).getTime();
              return (
                <Button
                  key={s.toISOString()}
                  type="button"
                  variant={sel ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChange(s)}
                  className={cn("rounded-full text-xs", sel && "bg-brand hover:bg-brand-700")}
                >
                  {s.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
