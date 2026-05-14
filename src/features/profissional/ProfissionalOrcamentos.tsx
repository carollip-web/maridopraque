import React from "react";
import { Clock, Pencil, Send, DollarSign, TrendingUp, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Stat } from "./ProfissionalStats";
import { ProfissionalGrid } from "./ProfissionalGrid";
import { Orcamento, Profile, ServicoCat, OrcMat, ClienteGeo } from "./types";

interface ProfissionalOrcamentosProps {
  pedidosSubTab: string;
  setPedidosSubTab: (sub: string) => void;
  counts: {
    oportunidades: number;
    elaboracao: number;
    enviados: number;
    ativos: number;
  };
  aReceber: number;
  loadingList: boolean;
  filterBy: (type: string) => Orcamento[];
  profiles: Record<string, Profile>;
  catalog: Record<string, ServicoCat>;
  orcMats: Record<string, OrcMat[]>;
  clienteGeo: Record<string, ClienteGeo>;
  profGeo: { lat: number | null; lng: number | null; raio: number };
  userId: string;
  enviar: any;
  refresh: () => void;
  recusarOrcamento: (id: string) => Promise<void>;
  handleGenerateTestOrder: () => void;
  minhasPropostas?: any[];
  propostasMateriais?: any[];
  especialidades?: string[];
  onProposalSent?: (data: { orcamentoId: string; proposta: any; orcamento: any }) => void;
}

export function ProfissionalOrcamentos({
  pedidosSubTab,
  setPedidosSubTab,
  counts,
  aReceber,
  loadingList,
  filterBy,
  profiles,
  catalog,
  orcMats,
  clienteGeo,
  profGeo,
  userId,
  enviar,
  refresh,
  recusarOrcamento,
  handleGenerateTestOrder,
  minhasPropostas,
  propostasMateriais,
  especialidades = [],
  onProposalSent,
}: ProfissionalOrcamentosProps) {
  return (
    <div className="space-y-6">
      <Tabs
        value={pedidosSubTab}
        onValueChange={setPedidosSubTab}
        className="w-full animate-in fade-in duration-700"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Pedidos e orçamentos
            </h2>
            <p className="text-sm text-muted-foreground">
              Acompanhe oportunidades, propostas em elaboração e retornos de clientes.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleGenerateTestOrder}
            className="rounded-full"
          >
            Gerar pedido teste
          </Button>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon={Clock}
            label="Na fila"
            value={counts.oportunidades}
            accent="bg-amber-100 text-amber-700"
          />
          <Stat
            icon={Pencil}
            label="Para enviar"
            value={counts.elaboracao}
            accent="bg-sky-100 text-sky-700"
          />
          <Stat
            icon={TrendingUp}
            label="Em andamento"
            value={counts.ativos}
            accent="bg-emerald-100 text-emerald-700"
          />
          <Stat
            icon={DollarSign}
            label="A receber"
            value={`R$ ${aReceber.toFixed(2)}`}
            accent="bg-brand-soft text-brand"
          />
        </section>

        <TabsList className="mt-6 h-auto w-full flex-wrap justify-start rounded-2xl border border-border bg-card p-1.5 shadow-sm lg:w-auto">
          <TabsTrigger value="oportunidades" className="rounded-xl px-4 py-2 text-sm font-medium">
            Radar <span className="ml-1.5 opacity-60">({counts.oportunidades})</span>
          </TabsTrigger>
          <TabsTrigger value="elaboracao" className="rounded-xl px-4 py-2 text-sm font-medium">
            Elaborar <span className="ml-1.5 opacity-60">({counts.elaboracao})</span>
          </TabsTrigger>
          <TabsTrigger value="enviados" className="rounded-xl px-4 py-2 text-sm font-medium">
            Enviados <span className="ml-1.5 opacity-60">({counts.enviados})</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {loadingList ? (
            <div className="grid min-h-60 place-items-center rounded-3xl border border-border bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : (
            <>
              <TabsContent value="oportunidades" className="mt-0 focus-visible:outline-none">
                {especialidades.length === 0 && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                    <Clock className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Você ainda não configurou suas especialidades.</p>
                      <p className="mt-1">
                        Vá em <strong>Configurações</strong> para selecionar os serviços que você realiza e começar a receber oportunidades compatíveis.
                      </p>
                    </div>
                  </div>
                )}
                <ProfissionalGrid
                  items={filterBy("oportunidades")}
                  profiles={profiles}
                  catalog={catalog}
                  orcMats={orcMats}
                  clienteGeo={clienteGeo}
                  profGeo={profGeo}
                  userId={userId}
                  mode="pegar"
                  enviar={enviar}
                  refresh={refresh}
                  onRecusar={recusarOrcamento}
                  onProposalSent={onProposalSent}
                  minhasPropostas={minhasPropostas}
                  propostasMateriais={propostasMateriais}
                  emptyMsg={especialidades.length === 0 
                    ? "Configure suas especialidades para ver oportunidades."
                    : "Nenhuma oportunidade disponível para suas especialidades no momento."}
                  emptyIcon={Clock}
                />
              </TabsContent>
              <TabsContent value="elaboracao" className="mt-0 focus-visible:outline-none">
                <ProfissionalGrid
                  items={filterBy("elaboracao")}
                  profiles={profiles}
                  catalog={catalog}
                  orcMats={orcMats}
                  clienteGeo={clienteGeo}
                  profGeo={profGeo}
                  userId={userId}
                  mode="enviar"
                  enviar={enviar}
                  refresh={refresh}
                  onProposalSent={onProposalSent}
                  minhasPropostas={minhasPropostas}
                  propostasMateriais={propostasMateriais}
                  emptyMsg="Você ainda não possui pedidos reservados para elaborar."
                  emptyIcon={Pencil}
                />
              </TabsContent>
              <TabsContent value="enviados" className="mt-0 focus-visible:outline-none">
                <ProfissionalGrid
                  items={filterBy("enviados")}
                  profiles={profiles}
                  catalog={catalog}
                  orcMats={orcMats}
                  clienteGeo={clienteGeo}
                  profGeo={profGeo}
                  userId={userId}
                  mode="revisar"
                  enviar={enviar}
                  refresh={refresh}
                  onProposalSent={onProposalSent}
                  minhasPropostas={minhasPropostas}
                  propostasMateriais={propostasMateriais}
                  emptyMsg="Nenhuma proposta enviada aguardando resposta."
                  emptyIcon={Send}
                />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
