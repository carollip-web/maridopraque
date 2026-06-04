import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format, subDays, startOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type TimePreset = "7d" | "30d" | "90d" | "month" | "year" | "custom";

export type DateRange = {
  from: Date;
  to: Date;
};

type DateRangeFilterProps = {
  preset: TimePreset;
  customRange: DateRange | null;
  onPresetChange: (preset: TimePreset) => void;
  onCustomRangeChange: (range: DateRange | null) => void;
};

const PRESETS = [
  { id: "7d" as TimePreset, label: "7 dias" },
  { id: "30d" as TimePreset, label: "30 dias" },
  { id: "90d" as TimePreset, label: "90 dias" },
  { id: "month" as TimePreset, label: "Este Mês" },
  { id: "year" as TimePreset, label: "Este Ano" },
];

/** Compute { from, to } from a preset string */
export function resolveDateRange(
  preset: TimePreset,
  customRange: DateRange | null,
): DateRange {
  const now = new Date();
  if (preset === "custom" && customRange) return customRange;
  if (preset === "7d") return { from: subDays(now, 7), to: now };
  if (preset === "90d") return { from: subDays(now, 90), to: now };
  if (preset === "month") return { from: startOfMonth(now), to: now };
  if (preset === "year") return { from: startOfYear(now), to: now };
  // default 30d
  return { from: subDays(now, 30), to: now };
}

/** Compute previous comparison period */
export function resolvePrevRange(range: DateRange): DateRange {
  const durationMs = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - durationMs),
    to: new Date(range.from.getTime()),
  };
}

export function DateRangeFilter({
  preset,
  customRange,
  onPresetChange,
  onCustomRangeChange,
}: DateRangeFilterProps) {
  const [calOpen, setCalOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(
    customRange?.from,
  );
  const [tempTo, setTempTo] = useState<Date | undefined>(customRange?.to);
  const [selectingStep, setSelectingStep] = useState<"from" | "to">("from");

  const handlePreset = (p: TimePreset) => {
    onPresetChange(p);
    onCustomRangeChange(null);
  };

  const handleCalendarSelect = (day: Date | undefined) => {
    if (!day) return;
    if (selectingStep === "from") {
      setTempFrom(day);
      setTempTo(undefined);
      setSelectingStep("to");
    } else {
      // Ensure from < to
      if (tempFrom && day < tempFrom) {
        setTempTo(tempFrom);
        setTempFrom(day);
      } else {
        setTempTo(day);
      }
      // Auto-apply once both selected
      const from = tempFrom && day < tempFrom ? day : tempFrom!;
      const to = tempFrom && day < tempFrom ? tempFrom : day;
      onCustomRangeChange({ from, to });
      onPresetChange("custom");
      setSelectingStep("from");
      setCalOpen(false);
    }
  };

  const clearCustom = () => {
    onCustomRangeChange(null);
    onPresetChange("30d");
    setTempFrom(undefined);
    setTempTo(undefined);
    setSelectingStep("from");
  };

  const isCustomActive = preset === "custom" && customRange;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset Buttons */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        {PRESETS.map((r) => (
          <button
            key={r.id}
            onClick={() => handlePreset(r.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              preset === r.id
                ? "bg-brand text-white shadow-md shadow-brand/20"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Custom Date Picker */}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              isCustomActive
                ? "bg-brand text-white border-brand shadow-md shadow-brand/20"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-brand/40"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {isCustomActive
              ? `${format(customRange.from, "dd/MM/yy")} – ${format(customRange.to, "dd/MM/yy")}`
              : "Período"}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto p-0 rounded-2xl border-slate-200 shadow-2xl"
        >
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">
              Selecionar período
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {selectingStep === "from"
                ? "Escolha a data de início"
                : "Agora escolha a data final"}
            </p>
            {(tempFrom || tempTo) && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-lg bg-brand/10 text-brand font-bold">
                  {tempFrom
                    ? format(tempFrom, "dd/MM/yyyy", { locale: ptBR })
                    : "..."}
                </span>
                <span className="text-slate-300">→</span>
                <span className="px-2 py-1 rounded-lg bg-brand/10 text-brand font-bold">
                  {tempTo
                    ? format(tempTo, "dd/MM/yyyy", { locale: ptBR })
                    : "..."}
                </span>
              </div>
            )}
          </div>
          <Calendar
            mode="single"
            selected={selectingStep === "from" ? tempFrom : tempTo}
            onSelect={handleCalendarSelect}
            disabled={{ after: new Date() }}
            modifiers={{
              range_start: tempFrom ? [tempFrom] : [],
              range_end: tempTo ? [tempTo] : [],
              range_middle:
                tempFrom && tempTo
                  ? {
                      after: tempFrom,
                      before: tempTo,
                    }
                  : [],
            }}
            modifiersClassNames={{
              range_start:
                "!bg-brand !text-white rounded-l-md rounded-r-none",
              range_end:
                "!bg-brand !text-white rounded-r-md rounded-l-none",
              range_middle: "!bg-brand/10 rounded-none",
            }}
            className="p-3"
          />
        </PopoverContent>
      </Popover>

      {/* Clear Custom Range */}
      {isCustomActive && (
        <button
          onClick={clearCustom}
          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"
          title="Limpar período customizado"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
