import { useQuery } from "@tanstack/react-query";
import { Wrench, Settings, ShieldCheck, Users, Star } from "lucide-react";
import { type Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

// Painel expandido de um profissional na listagem admin: ganhos, serviços
// ou avaliações, conforme a aba escolhida.
export function ProDetailView({
  proId,
  view,
}: {
  proId: string;
  view: "ganhos" | "servicos" | "nota";
}) {
  const { data: details, isLoading } = useQuery({
    queryKey: ["admin", "pro-details", proId, view],
    queryFn: async () => {
      if (view === "ganhos" || view === "servicos") {
        const query = supabase
          .from("orcamentos")
          .select("id, created_at, valor, status, service_name, profiles(nome)")
          .eq("profissional_id", proId);

        if (view === "ganhos") query.eq("status", "pago");
        const { data } = await query.order("created_at", { ascending: false });
        return data || [];
      } else {
        const { data } = await supabase
          .from("avaliacoes")
          .select("id, nota, comentario, created_at, cliente_id")
          .eq("profissional_id", proId)
          .order("created_at", { ascending: false });
        return data || [];
      }
    },
  });

  if (isLoading)
    return (
      <div className="mt-4 p-4 bg-white/5 rounded-xl animate-pulse text-white/50 text-xs">
        Carregando detalhes...
      </div>
    );

  return (
    <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
      {details?.length === 0 && (
        <p className="text-xs text-white/40 text-center py-4">Nenhum registro encontrado.</p>
      )}

      {view === "nota"
        ? (details as unknown as Tables<"avaliacoes">[]).map((av) => (
            <div key={av.id} className="text-left border-b border-white/5 pb-2 last:border-0">
              <div className="flex justify-between items-center mb-1">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-2.5 w-2.5 ${i < av.nota ? "fill-amber-400 text-amber-400" : "text-white/20"}`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-white/30">
                  {new Date(av.created_at).toLocaleDateString()}
                </span>
              </div>
              {av.comentario && (
                <p className="text-xs text-white/70 italic line-clamp-2">"{av.comentario}"</p>
              )}
            </div>
          ))
        : (details as unknown as Tables<"orcamentos">[]).map((orc) => (
            <div
              key={orc.id}
              className="flex justify-between items-center text-left border-b border-white/5 pb-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold truncate text-white/90">
                  {orc.service_name || "Serviço sem nome"}
                </p>
                <p className="text-[10px] text-white/40">
                  {new Date(orc.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs font-bold text-white">R$ {orc.valor || 0}</p>
                <span
                  className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    orc.status === "pago"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {orc.status}
                </span>
              </div>
            </div>
          ))}
    </div>
  );
}

export const ESPECIALIDADES_OPCOES = [
  {
    categoria: "Montagem",
    icon: Wrench,
    opcoes: [
      "Montagem de Móveis",
      "Furos e Fixação",
      "Instalação de Prateleiras",
      "Suporte de TV",
      "Instalação de Cortinas",
      "Instalação de Ar-Condicionado",
    ],
  },
  {
    categoria: "Reparos",
    icon: Settings,
    opcoes: [
      "Elétrica Básica",
      "Hidráulica",
      "Resistência de Chuveiro",
      "Reparos Gerais",
      "Pintura",
      "Gesso e Drywall",
      "Fechaduras e Dobradiças",
    ],
  },
  {
    categoria: "Engenharia",
    icon: ShieldCheck,
    opcoes: [
      "Legalização de Projetos",
      "Regularização de Obras",
      "Laudos Técnicos",
      "Segurança do Trabalho",
      "Habite-se e Alvarás",
      "Projetos Arquitetônicos",
    ],
  },
  {
    categoria: "Apoio e Segurança",
    icon: Users,
    opcoes: ["Apoio Feminino"],
  },
];
