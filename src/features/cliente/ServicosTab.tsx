import React, { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AvaliacaoForm } from "@/components/AvaliacaoForm";
import { Tab } from "./constants";

export function ServicosTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [repetindo, setRepetindo] = useState<string | null>(null);

  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ["cliente", "servicos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("orcamentos")
        .select("id, service_name, service_id, valor, profissional_id, data_pagamento, created_at")
        .eq("cliente_id", user.id)
        .eq("status", "pago")
        .order("data_pagamento", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const repetir = async (s: any) => {
    if (!user) return;
    setRepetindo(s.id);
    const { data, error } = await supabase
      .from("orcamentos")
      .insert({
        cliente_id: user.id,
        service_id: s.service_id,
        service_name: s.service_name,
        descricao: `Repetição do pedido ${s.id.slice(0, 8)}`,
      })
      .select("id")
      .single();
    setRepetindo(null);
    if (error || !data) {
      const { toast } = await import("sonner");
      toast.error("Não foi possível repetir o pedido");
      return;
    }
    navigate({
      to: "/cliente",
      search: (prev: any) => ({
        ...prev,
        tab: "pedidos" as Tab,
        pedidoId: data.id,
        id: undefined,
        details: undefined,
      }),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-border p-6 md:p-8 space-y-6">
            <div className="flex justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (servicos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-border p-12 text-center">
        <History className="h-10 w-10 text-muted-foreground/50 mx-auto mb-4" />
        <p className="font-bold text-lg">Você ainda não tem serviços concluídos</p>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Quando um serviço for pago e finalizado, ele aparece aqui.
        </p>
        <Button asChild className="rounded-full bg-brand text-brand-foreground font-bold h-11 px-6">
          <Link to="/servicos">Pedir um orçamento</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {servicos.map((s) => (
        <article
          key={s.id}
          className="bg-white rounded-2xl border border-border shadow-soft p-6 md:p-8"
        >
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg">{s.service_name}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                #{s.id.slice(0, 8)} •{" "}
                {s.data_pagamento ? new Date(s.data_pagamento).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">R$ {Number(s.valor || 0).toFixed(2)}</span>
              <Button
                onClick={() => repetir(s)}
                disabled={repetindo === s.id}
                size="sm"
                variant="outline"
                className="rounded-full font-bold h-9 px-4"
              >
                {repetindo === s.id ? "..." : "Pedir de novo"}
              </Button>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Como foi este serviço?
            </p>
            <AvaliacaoForm
              orcamentoId={s.id}
              clienteId={user!.id}
              profissionalId={s.profissional_id}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
