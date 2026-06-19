import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  ChevronRight,
  Plus,
  X,
  FileText,
  CalendarDays,
  MessageCircle,
} from "lucide-react";
import { type Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tab } from "./constants";

interface DashboardTabProps {
  setActiveTab: (tab: Tab) => void;
}

export function DashboardTab({ setActiveTab }: DashboardTabProps) {
  const [showBanner, setShowBanner] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["cliente", "stats", user?.id],
    queryFn: async () => {
      if (!user) return { concluidos: 0, ativos: 0, pendentes: 0, total: 0, recentes: [] as Tables<"orcamentos">[] };
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, status, valor, service_name, created_at, data_agendada")
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });

      if (error) console.error("Error fetching stats orcamentos:", error);

      const list = data || [];

      let proximo: any = null;
      const proximoCand = list
        .filter((o) => ["pago", "aprovado"].includes(o.status) && o.data_agendada && new Date(o.data_agendada) >= new Date())
        .sort((a, b) => new Date(a.data_agendada!).getTime() - new Date(b.data_agendada!).getTime())[0];
      
      if (proximoCand) {
        const { data: pData } = await supabase.from("orcamentos").select("profissional_id").eq("id", proximoCand.id).single();
        if (pData?.profissional_id) {
          const { data: profProfile } = await supabase.from("profiles").select("nome").eq("id", pData.profissional_id).single();
          proximo = { ...proximoCand, profNome: profProfile?.nome || "Profissional" };
        } else {
          proximo = proximoCand;
        }
      }

      return {
        // "Serviços Realizados" = realmente concluídos pelo cliente
        concluidos: list.filter((o) => o.status === "concluido").length,
        // "Pedidos Ativos" = pagos/agendados + em andamento
        ativos: list.filter((o) => ["pago", "aprovado", "enviado", "fixo_auto"].includes(o.status)).length,
        pendentes: list.filter((o) => o.status === "customizado_pendente").length,
        // Total investido = soma de tudo que o cliente já pagou (pago + concluído)
        total: list.filter((o) => ["pago", "concluido"].includes(o.status)).reduce((acc, o) => acc + (o.valor || 0), 0),
        recentes: list.slice(0, 3),
        proximo,
      };
    },
    enabled: !!user,
  });

  const statsItems = [
    {
      label: "Serviços Realizados",
      value: stats?.concluidos ?? "0",
      icon: CheckCircle2,
      color: "text-green-600",
      tab: "servicos" as const,
    },
    {
      label: "Pedidos Ativos",
      value: stats?.ativos ?? "0",
      icon: Clock,
      color: "text-[#b85c45]",
      tab: "pedidos" as const,
    },
    {
      label: "Orçamentos Pendentes",
      value: stats?.pendentes ?? "0",
      icon: AlertCircle,
      color: "text-amber-500",
      tab: "pedidos" as const,
    },
    {
      label: "Total Investido",
      value: `R$ ${stats?.total.toFixed(0) ?? "0"}`,
      icon: CreditCard,
      color: "text-slate-600",
      tab: "pagamentos" as const,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-3xl border border-border shadow-soft space-y-4"
              >
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))
          : statsItems.map((stat) => (
              <div
                key={stat.label}
                className="bg-white p-6 rounded-3xl border border-border shadow-soft hover:shadow-md hover:border-brand/20 transition-all cursor-pointer group"
                onClick={() => setActiveTab(stat.tab)}
              >
                <div
                  className={`h-11 w-11 rounded-full bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-brand/10 transition-colors`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-sm font-medium text-muted-foreground group-hover:text-brand transition-colors">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
            ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          {/* Próximo Serviço */}
          <section className="bg-brand text-brand-foreground rounded-[2rem] border border-brand/20 p-8 shadow-xl relative overflow-hidden">
            <CalendarDays className="absolute -right-6 -bottom-6 h-32 w-32 text-white/5" />
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Clock className="h-5 w-5" /> Seu Próximo Serviço
            </h2>
            
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/2 bg-white/20" />
                <Skeleton className="h-4 w-1/3 bg-white/20" />
                <Skeleton className="h-10 w-full rounded-full bg-white/20 mt-4" />
              </div>
            ) : stats?.proximo ? (
              <div className="relative z-10">
                <p className="font-bold text-2xl">{stats.proximo.service_name}</p>
                <p className="text-white/80 mt-1">
                  {new Date(stats.proximo.data_agendada).toLocaleString("pt-BR", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </p>
                {stats.proximo.profNome && (
                  <p className="text-sm font-medium mt-2 bg-white/10 inline-block px-3 py-1 rounded-full">
                    Com {stats.proximo.profNome}
                  </p>
                )}
                <Button
                  onClick={() => navigate({ to: "/cliente", search: { chat: "1", pedidoId: stats.proximo.id } as any })}
                  className="w-full sm:w-auto mt-6 bg-white text-brand hover:bg-white/90 rounded-full font-bold shadow-lg"
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> Conversar
                </Button>
              </div>
            ) : (
              <div className="relative z-10">
                <p className="text-white/80 font-medium text-lg">
                  Nenhum serviço agendado — Solicite um novo!
                </p>
                <Button
                  onClick={() => navigate({ to: "/servicos" })}
                  className="mt-6 bg-white text-brand hover:bg-white/90 rounded-full font-bold shadow-lg"
                >
                  <Plus className="h-4 w-4 mr-2" /> Novo Orçamento
                </Button>
              </div>
            )}
          </section>

          {/* Recent Activity */}
          <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">Atividade Recente</h2>
            <button
              className="text-sm font-semibold text-brand hover:underline"
              onClick={() => setActiveTab("pedidos")}
            >
              Ver tudo
            </button>
          </div>
          <div className="space-y-6">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-4 w-4" />
                </div>
              ))
            ) : (stats?.recentes || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma atividade recente.</p>
            ) : (
              stats?.recentes.map((item: any, i: number) => {
                const isConcluido = item.status === "concluido";
                const isAgendado = item.status === "pago";
                const isOrcamento = item.status === "customizado_pendente";
                const isFixo = item.status === "fixo_auto";
                return (
                  <div
                    key={i}
                    className="flex items-center gap-4 group cursor-pointer"
                    onClick={() => setActiveTab(isConcluido ? "servicos" : "pedidos")}
                  >
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                        isConcluido
                          ? "bg-green-50 text-green-600"
                          : isOrcamento || isFixo
                            ? "bg-amber-50 text-amber-600"
                            : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {isConcluido ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : isOrcamento || isFixo ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold group-hover:text-brand transition-colors">
                        {item.service_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isConcluido
                          ? "Concluído"
                          : isAgendado
                            ? "Agendado"
                            : isOrcamento || isFixo
                              ? "Aguardando orçamento"
                              : "Em andamento"}{" "}
                        • {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                );
              })
            )}
          </div>
        </section>
        </div>

        {/* Quick Actions */}
        <section className="space-y-6">
          {showBanner && (
            <div className="bg-foreground text-background rounded-[2rem] p-8 shadow-xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
              <button
                onClick={() => setShowBanner(false)}
                className="absolute right-6 top-6 z-10 p-2 rounded-full bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-all"
              >
                <X className="h-4 w-4" />
              </button>
              <Plus className="absolute -right-4 -top-4 h-32 w-32 text-white/10 rotate-12" />
              <h3 className="text-xl font-bold mb-2">Novo Serviço?</h3>
              <p className="text-sm text-white/70 mb-6">
                Solicite um novo orçamento agora pela plataforma.
              </p>
              <Button
                onClick={() => navigate({ to: "/servicos" })}
                className="w-full rounded-full bg-brand text-brand-foreground hover:bg-brand/90 font-bold"
              >
                Solicitar Agora
              </Button>
            </div>
          )}



          <div className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
            <h3 className="font-bold mb-4">Dica de Segurança</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Todos os profissionais passam por verificação de identidade com documento e selfie antes de serem aprovados na plataforma. Em caso de qualquer problema, abra uma disputa pelo painel do pedido.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
