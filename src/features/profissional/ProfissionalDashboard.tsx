import React from "react";
import {
  Clock,
  Pencil,
  TrendingUp,
  DollarSign,
  CalendarClock,
  Star,
  Wallet,
  Settings,
} from "lucide-react";
import { ProfileCompletenessCard } from "@/components/ProfileCompletenessCard";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import { NivelBadge } from "@/components/NivelBadge";
import { ProfissionalChart } from "@/components/ProfissionalChart";
import { ProfissionalIndicacao } from "@/components/ProfissionalIndicacao";
import { ProfissionalHeader } from "./ProfissionalHeader";

import { PixRepasseSettings } from "./PixRepasseSettings";
import { ActionStat, QuickLink } from "./ProfissionalStats";
import { Orcamento, ProfissionalTab } from "./types";

interface ProfissionalDashboardProps {
  user: any;
  counts: {
    oportunidades: number;
    elaboracao: number;
    enviados: number;
    ativos: number;
    finalizados: number;
  };
  metrics: {
    ganhosMes: number;
    taxaAceitacao: string;
    slaMedioH: string;
    totalConcluidos: number;
    aReceber: number;
    mediaAvaliacoes: string;
  };
  orcamentos: Orcamento[];
  setTab: (tab: ProfissionalTab) => void;
  setPedidosSubTab: (sub: string) => void;
  setServicosSubTab: (sub: string) => void;
}

export function ProfissionalDashboard({
  user,
  counts,
  metrics,
  orcamentos,
  setTab,
  setPedidosSubTab,
  setServicosSubTab,
}: ProfissionalDashboardProps) {
  return (
    <div className="space-y-6">
      <NotificationPermissionBanner />

      <ProfissionalHeader
        userName={(user?.user_metadata as any)?.nome || "profissional"}
        counts={counts}
        metrics={metrics}
        onVerPedidos={() => setTab("orcamentos")}
      />

      <ProfileCompletenessCard />

      <PixRepasseSettings />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ActionStat
          icon={Clock}
          label="Oportunidades no radar"
          value={counts.oportunidades}
          accent="from-amber-50 to-amber-100 text-amber-700 ring-amber-200"
          cta="Ver radar"
          onClick={() => {
            setPedidosSubTab("oportunidades");
            setTab("orcamentos");
          }}
        />
        <ActionStat
          icon={Pencil}
          label="Para elaborar"
          value={counts.elaboracao}
          accent="from-sky-50 to-sky-100 text-sky-700 ring-sky-200"
          cta="Elaborar agora"
          onClick={() => {
            setPedidosSubTab("elaboracao");
            setTab("orcamentos");
          }}
        />
        <ActionStat
          icon={TrendingUp}
          label="Em andamento"
          value={counts.ativos}
          accent="from-emerald-50 to-emerald-100 text-emerald-700 ring-emerald-200"
          cta="Ver serviços"
          onClick={() => {
            setServicosSubTab("ativos");
            setTab("servicos");
          }}
        />
        <ActionStat
          icon={DollarSign}
          label="A receber"
          value={`R$ ${metrics.aReceber.toFixed(2)}`}
          accent="from-orange-50 to-orange-100 text-brand ring-orange-200"
          cta="Financeiro"
          onClick={() => setTab("financeiro")}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProfissionalChart orcamentos={orcamentos as any} userId={user?.id} />
        </div>
        <div className="space-y-4">
          <NivelBadge
            concluidos={metrics.totalConcluidos}
            notaMedia={Number(metrics.mediaAvaliacoes) || 0}
          />
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-foreground">Atalhos rápidos</h3>
            </div>
            <div className="grid gap-2">
              <QuickLink
                icon={CalendarClock}
                label="Minha agenda"
                onClick={() => setTab("agenda")}
              />
              <QuickLink icon={Star} label="Avaliações" onClick={() => setTab("avaliacoes")} />
              <QuickLink icon={Wallet} label="Financeiro" onClick={() => setTab("financeiro")} />
              <QuickLink
                icon={Settings}
                label="Perfil e configurações"
                onClick={() => setTab("configuracoes")}
              />
            </div>
          </div>
        </div>
      </div>

      <ProfissionalIndicacao nome={(user?.user_metadata as any)?.nome ?? ""} />
    </div>
  );
}
