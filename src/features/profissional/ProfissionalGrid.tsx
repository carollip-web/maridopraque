import React from "react";
import { Orcamento, Profile, ServicoCat, OrcMat, ClienteGeo } from "./types";
import { distanceKm } from "@/lib/geo";
import { OrcamentoCard } from "./OrcamentoCard";

interface ProfissionalGridProps {
  items: Orcamento[];
  profiles: Record<string, Profile>;
  catalog: Record<string, ServicoCat>;
  orcMats: Record<string, OrcMat[]>;
  mode: "pegar" | "enviar" | "revisar" | "info";
  enviar: any;
  refresh?: () => void;
  emptyMsg: string;
  emptyIcon: any;
  clienteGeo: Record<string, ClienteGeo>;
  profGeo: { lat: number | null; lng: number | null; raio: number };
  userId: string;
  onRecusar?: (id: string) => Promise<void>;
  onProposalSent?: (data: { orcamentoId: string; proposta: any; orcamento: any }) => void;
  disableChat?: boolean;
  minhasPropostas?: any[];
  materiaisCat?: any[];
  propostasMateriais?: any[];
  minhaAgenda?: any;
  profGenero?: string | null;
  profApoioFeminino?: boolean;
}

export function ProfissionalGrid({
  items,
  profiles,
  catalog,
  orcMats,
  mode,
  enviar,
  refresh,
  emptyMsg,
  emptyIcon: EmptyIcon,
  clienteGeo,
  profGeo,
  userId,
  onRecusar,
  onProposalSent,
  disableChat = false,
  minhasPropostas,
  materiaisCat,
  propostasMateriais,
  minhaAgenda,
  profGenero,
  profApoioFeminino,
}: ProfissionalGridProps) {
  if (items.length === 0) {
    return (
      <div className="py-24 px-6 text-center bg-white rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center">
        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
          <EmptyIcon className="h-8 w-8 text-slate-300" />
        </div>
        <p className="text-slate-500 font-medium text-sm max-w-sm">{emptyMsg}</p>
      </div>
    );
  }

  const distFor = (cid: string): number | null => {
    if (profGeo.lat == null || profGeo.lng == null) return null;
    const g = clienteGeo[cid];
    if (!g || g.lat == null || g.lng == null) return null;
    return distanceKm({ lat: profGeo.lat, lng: profGeo.lng }, { lat: g.lat, lng: g.lng });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((o) => (
        <OrcamentoCard
          key={o.id}
          o={o}
          cliente={profiles[o.cliente_id]}
          clienteCidade={clienteGeo[o.cliente_id]?.cidade ?? null}
          distanciaKm={distFor(o.cliente_id)}
          range={o.service_id ? catalog[o.service_id] : undefined}
          materiais={orcMats[o.id] ?? []}
          mode={mode}
          enviar={enviar}
          refresh={refresh}
          userId={userId}
          onRecusar={onRecusar}
          onProposalSent={onProposalSent}
          minhaProposta={minhasPropostas?.find((p: any) => p.orcamento_id === o.id)}
          materiaisCat={materiaisCat}
          propostaMateriais={propostasMateriais?.filter(
            (pm: any) =>
              pm.proposta_id === minhasPropostas?.find((p: any) => p.orcamento_id === o.id)?.id,
          )}
          minhaAgenda={minhaAgenda}
          profGenero={profGenero}
          profApoioFeminino={profApoioFeminino}
        />
      ))}
    </div>
  );
}
