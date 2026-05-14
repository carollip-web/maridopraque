import React from "react";

export function DashStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
      <p className="text-[11px] uppercase tracking-wider text-white/70">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-full grid place-items-center ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

export function ActionStat({
  icon: Icon,
  label,
  value,
  accent,
  cta,
  onClick,
}: {
  icon: any;
  label: string;
  value: number | string;
  accent: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left bg-gradient-to-br ${accent} rounded-2xl p-4 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-full bg-white/70 backdrop-blur grid place-items-center shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-black tracking-tight">{value}</p>
      </div>
      <p className="mt-3 text-xs uppercase tracking-widest font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-xs font-bold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
        {cta} <span aria-hidden>→</span>
      </p>
    </button>
  );
}

export function QuickLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: any;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-brand-soft hover:text-brand transition-colors"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 text-left">{label}</span>
      <span className="text-muted-foreground" aria-hidden>
        ›
      </span>
    </button>
  );
}
