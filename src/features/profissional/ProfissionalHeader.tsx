import React from "react";
import { Button } from "@/components/ui/button";
import { DashStat } from "./ProfissionalStats";

interface ProfissionalHeaderProps {
  userName: string;
  counts: {
    oportunidades: number;
    elaboracao: number;
  };
  metrics: {
    ganhosMes: number;
    taxaAceitacao: string;
    slaMedioH: string;
    totalConcluidos: number;
  };
  onVerPedidos: () => void;
}

export function ProfissionalHeader({
  userName,
  counts,
  metrics,
  onVerPedidos,
}: ProfissionalHeaderProps) {
  const greetingByHour = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-orange-500 to-amber-500 text-white p-6 sm:p-8 shadow-xl">
      <div
        className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div
        className="absolute -left-8 -bottom-16 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70 font-semibold">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">
            {greetingByHour()}, {userName.split(" ")[0]}!
          </h2>
          <p className="mt-2 text-sm text-white/85 max-w-md">
            {counts.oportunidades > 0
              ? `Você tem ${counts.oportunidades} oportunidade${counts.oportunidades > 1 ? "s" : ""} esperando no radar.`
              : counts.elaboracao > 0
                ? `${counts.elaboracao} orçamento${counts.elaboracao > 1 ? "s" : ""} aguardando você enviar a proposta.`
                : "Tudo em dia por aqui. Continue acompanhando seus pedidos."}
          </p>
        </div>
        <Button
          onClick={onVerPedidos}
          className="rounded-full bg-white text-brand hover:bg-white/90 shadow-md font-bold"
        >
          Ver pedidos
        </Button>
      </div>
      <div className="relative mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DashStat label="Ganhos do mês" value={`R$ ${metrics.ganhosMes.toFixed(2)}`} />
        <DashStat label="Aceitação" value={metrics.taxaAceitacao} />
        <DashStat label="SLA médio" value={metrics.slaMedioH} />
        <DashStat label="Concluídos" value={String(metrics.totalConcluidos)} />
      </div>
    </section>
  );
}
