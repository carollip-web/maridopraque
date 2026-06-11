import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OrcamentoCard } from "./OrcamentoCard";
import {
  Orcamento,
  Profile,
  ServicoCat,
  OrcMat,
  ClienteGeo,
} from "./types";

export type SheetMode = "pegar" | "enviar" | "revisar" | "info";

interface OrcamentoDetailsSheetProps {
  orcamento: Orcamento | null;
  onClose: () => void;
  cliente: Profile | undefined;
  clienteCidade: string | null;
  range: ServicoCat | undefined;
  materiais: OrcMat[];
  mode: SheetMode;
  enviar: any;
  onProposalSent: (data: {
    orcamentoId: string;
    proposta: any;
    orcamento: any;
  }) => void;
  refresh: () => void;
  userId: string;
  onRecusar: (id: string) => Promise<void>;
  propostaMateriais: any[];
  minhaAgenda: any;
  profGenero: string | null;
  profApoioFeminino: boolean;
}

/**
 * Painel lateral (Sheet) com os detalhes de um orçamento selecionado.
 * Extraído do route file para isolar a árvore do Sheet.
 */
export function OrcamentoDetailsSheet({
  orcamento,
  onClose,
  cliente,
  clienteCidade,
  range,
  materiais,
  mode,
  enviar,
  onProposalSent,
  refresh,
  userId,
  onRecusar,
  propostaMateriais,
  minhaAgenda,
  profGenero,
  profApoioFeminino,
}: OrcamentoDetailsSheetProps) {
  return (
    <Sheet
      open={!!orcamento}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
        aria-describedby={undefined}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border bg-slate-50">
          <SheetTitle className="text-lg font-bold">
            {orcamento?.service_name ?? "Pedido"}
          </SheetTitle>
        </SheetHeader>
        <div className="p-6">
          {orcamento && (
            <OrcamentoCard
              key={orcamento.id + "-sheet"}
              o={orcamento}
              cliente={cliente}
              clienteCidade={clienteCidade}
              distanciaKm={null}
              range={range}
              materiais={materiais}
              mode={mode}
              enviar={enviar}
              onProposalSent={onProposalSent}
              refresh={() => {
                refresh();
                onClose();
              }}
              userId={userId}
              onRecusar={async (id) => {
                await onRecusar(id);
                onClose();
              }}
              propostaMateriais={propostaMateriais}
              minhaAgenda={minhaAgenda}
              profGenero={profGenero}
              profApoioFeminino={profApoioFeminino}
              disableChat
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
