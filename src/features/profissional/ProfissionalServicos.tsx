import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProfissionalGrid } from "./ProfissionalGrid";
import { Orcamento, Profile, ServicoCat, OrcMat, ClienteGeo } from "./types";

interface ProfissionalServicosProps {
  servicosSubTab: string;
  setServicosSubTab: (sub: string) => void;
  counts: {
    ativos: number;
    finalizados: number;
  };
  filterBy: (type: string) => Orcamento[];
  profiles: Record<string, Profile>;
  catalog: Record<string, ServicoCat>;
  orcMats: Record<string, OrcMat[]>;
  clienteGeo: Record<string, ClienteGeo>;
  profGeo: { lat: number | null; lng: number | null; raio: number };
  userId: string;
  enviar: any;
  refresh: () => void;
  minhasPropostas?: any[];
  propostasMateriais?: any[];
  minhaAgenda?: any;
}

export function ProfissionalServicos({
  servicosSubTab,
  setServicosSubTab,
  counts,
  filterBy,
  profiles,
  catalog,
  orcMats,
  clienteGeo,
  profGeo,
  userId,
  enviar,
  refresh,
  minhasPropostas,
  propostasMateriais,
}: ProfissionalServicosProps) {
  return (
    <div className="space-y-8">
      <Tabs
        value={servicosSubTab}
        onValueChange={setServicosSubTab}
        className="w-full animate-in fade-in duration-700"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight hidden lg:block">
            Meus Serviços em Andamento
          </h2>
          <TabsList className="bg-white border border-slate-200 shadow-sm rounded-full h-auto p-1.5 flex-wrap w-full lg:w-auto">
            <TabsTrigger
              value="ativos"
              className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900 data-[state=active]:shadow-none transition-all font-medium"
            >
              Em andamento <span className="ml-1.5 opacity-60">({counts.ativos})</span>
            </TabsTrigger>
            <TabsTrigger
              value="finalizados"
              className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none transition-all font-medium"
            >
              Histórico <span className="ml-1.5 opacity-60">({counts.finalizados})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ativos" className="mt-0 focus-visible:outline-none">
          <ProfissionalGrid
            items={filterBy("ativos")}
            profiles={profiles}
            catalog={catalog}
            orcMats={orcMats}
            clienteGeo={clienteGeo}
            profGeo={profGeo}
            userId={userId}
            mode="info"
            enviar={enviar}
            refresh={refresh}
            minhasPropostas={minhasPropostas}
            propostasMateriais={propostasMateriais}
            minhaAgenda={minhaAgenda}
            emptyMsg="Você não possui nenhum serviço em andamento."
            emptyIcon={CheckCircle2}
          />
        </TabsContent>
        <TabsContent value="finalizados" className="mt-0 focus-visible:outline-none">
          <ProfissionalGrid
            items={filterBy("finalizados")}
            profiles={profiles}
            catalog={catalog}
            orcMats={orcMats}
            clienteGeo={clienteGeo}
            profGeo={profGeo}
            userId={userId}
            mode="info"
            enviar={enviar}
            refresh={refresh}
            minhasPropostas={minhasPropostas}
            propostasMateriais={propostasMateriais}
            minhaAgenda={minhaAgenda}
            emptyMsg="Seu histórico de atendimentos está vazio."
            emptyIcon={XCircle}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
