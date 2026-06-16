import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Pencil,
  Send,
} from "lucide-react";
import { aceitarProposta, decidirOrcamento } from "@/lib/orcamentos.functions";
import { brl, statusLabel } from "./constants";
import { OrcamentoRow, OrcMaterial } from "./types";

interface OrcamentoListItemProps {
  o: OrcamentoRow;
  materiais: OrcMaterial[];
  propostas: any[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onEdit: (o: OrcamentoRow) => void;
  refresh: () => void;
}

export function OrcamentoListItem({
  o,
  materiais,
  propostas,
  expanded,
  onToggleExpanded,
  onEdit,
  refresh,
}: OrcamentoListItemProps) {
  const decidir = useServerFn(decidirOrcamento);
  const aceitarProp = useServerFn(aceitarProposta);

  const hasProps = propostas.length > 0;
  const s =
    o.status === "customizado_pendente" && hasProps
      ? { label: "Aguardando Aprovação", cls: "bg-blue-50 text-blue-700" }
      : (statusLabel[o.status] ?? {
          label: o.status,
          cls: "bg-slate-100 text-slate-700",
        });
  const podeAprovar = o.status === "enviado" || o.status === "fixo_auto";

  return (
    <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-bold text-lg">{o.service_name}</h3>
          {o.descricao && (
            <p className="text-sm text-muted-foreground mt-1">{o.descricao}</p>
          )}
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${s.cls}`}>
          {s.label}
        </span>
      </div>

      {o.valor != null && (
        <div className="mb-2">
          <p className="text-2xl font-bold text-foreground">
            {brl(Number(o.valor))}
          </p>
          {(Number(o.valor_servico ?? 0) > 0 || Number(o.taxa_material) > 0) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Mão de obra {brl(Number(o.valor_servico ?? 0))} · Materiais{" "}
              {brl(Number(o.taxa_material))}
            </p>
          )}
        </div>
      )}

      {materiais.length > 0 && (
        <button
          onClick={onToggleExpanded}
          className="text-xs text-brand font-semibold flex items-center gap-1 mb-2"
        >
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {materiais.length}{" "}
          {materiais.length === 1 ? "material" : "materiais"}
        </button>
      )}
      {expanded && materiais.length > 0 && (
        <ul className="text-xs space-y-1 bg-slate-50 rounded-xl p-3 mb-3">
          {materiais.map((m) => (
            <li key={m.id} className="flex justify-between">
              <span>
                {m.nome_snapshot}{" "}
                <span className="text-muted-foreground">
                  × {Number(m.quantidade)} {m.unidade_snapshot}
                </span>
              </span>
              <span className="font-medium tabular-nums">
                {brl(Number(m.subtotal))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {o.observacoes_profissional && (
        <p className="text-sm italic text-muted-foreground mb-3">
          "{o.observacoes_profissional}"
        </p>
      )}
      {o.auto_aprovado && (
        <p className="text-xs text-green-700 font-medium mb-3 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Aprovado automaticamente (cliente
          recorrente)
        </p>
      )}

      {(o.status === "customizado_pendente" || o.status === "enviado") &&
        propostas.length > 0 && (
          <div className="mt-4 pt-4 border-t border-dashed border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Send className="h-3 w-3" /> Propostas Recebidas (
              {propostas.length})
            </h4>
            <div className="space-y-2">
              {propostas.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-bold">
                      {p.profNome || "Profissional"}
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {brl(Number(p.valor_servico))}
                    </p>
                    {p.observacoes && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        "{p.observacoes}"
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await aceitarProp({
                          data: { orcamentoId: o.id, propostaId: p.id },
                        });
                        toast.success("Proposta aceita! Agora você pode pagar.");
                        refresh();
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                    className="bg-brand text-brand-foreground rounded-full font-bold"
                  >
                    Aceitar Proposta
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
        {podeAprovar && (
          <>
            <Button
              onClick={() =>
                decidir({ data: { orcamentoId: o.id, decisao: "aprovado" } })
              }
              className="bg-green-600 hover:bg-green-700 text-white rounded-full gap-2 font-bold"
            >
              <CheckCircle2 className="h-4 w-4" /> Aprovar
            </Button>
            <Button
              onClick={() =>
                decidir({ data: { orcamentoId: o.id, decisao: "recusado" } })
              }
              variant="outline"
              className="rounded-full gap-2"
            >
              <XCircle className="h-4 w-4" /> Recusar
            </Button>
          </>
        )}
        {o.status === "aprovado" && (
          <div className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-900">
                  Orçamento Aprovado!
                </p>
                <p className="text-xs text-emerald-700">
                  Tudo pronto para começar seu serviço.
                </p>
              </div>
            </div>
            <Button
              asChild
              className="w-full sm:w-auto bg-brand text-brand-foreground rounded-full font-bold h-11 px-6 shadow-lg shadow-brand/20"
            >
              <Link to="/checkout" search={{ orcamentoId: o.id }}>
                Ir para pagamento seguro{" "}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        )}
        {o.status === "customizado_pendente" && (
          <>
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-1">
              <Clock className="h-4 w-4" /> Um profissional vai analisar e
              enviar o valor.
            </p>
            <Button
              variant="outline"
              onClick={() => onEdit(o)}
              className="rounded-full gap-2"
            >
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
