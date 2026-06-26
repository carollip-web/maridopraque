import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listarHistoricoContatos, type ContatoHistoricoItem } from "@/lib/admin-contato-log.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, MessageCircle, Phone, Eye, X, Loader2 } from "lucide-react";

export function ContatoHistoricoDialog({
  open,
  onOpenChange,
  destinatarioUserId,
  destinatarioEmail,
  nome,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  destinatarioUserId?: string | null;
  destinatarioEmail?: string | null;
  nome?: string | null;
}) {
  const listar = useServerFn(listarHistoricoContatos);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ContatoHistoricoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    listar({ data: { destinatario_user_id: destinatarioUserId ?? null, destinatario_email: destinatarioEmail ?? null } })
      .then((r: any) => {
        if (!alive) return;
        if (r.ok) setItems(r.items);
        else setError(r.error || "Erro ao carregar");
      })
      .catch((e) => alive && setError(String(e?.message || e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, destinatarioUserId, destinatarioEmail, listar]);

  const Icon = (tipo: string) =>
    tipo === "email" ? Mail : tipo === "whatsapp" ? MessageCircle : Phone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Histórico de contatos {nome ? `— ${nome}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Nenhum contato registrado ainda.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((it) => {
                const I = Icon(it.tipo);
                const cor =
                  it.tipo === "email"
                    ? "text-blue-600 bg-blue-50"
                    : it.tipo === "whatsapp"
                      ? "text-emerald-600 bg-emerald-50"
                      : "text-slate-600 bg-slate-100";
                return (
                  <li key={it.id} className="py-3 flex gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cor}`}>
                      <I className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900">{it.assunto}</span>
                        <span
                          className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                            it.status === "sent" || it.status === "registrado"
                              ? "bg-emerald-100 text-emerald-700"
                              : it.status === "pending"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {it.status === "sent" ? "enviado" : it.status === "registrado" ? "registrado" : it.status || "—"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(it.created_at).toLocaleString("pt-BR")}
                        {it.admin_nome ? ` · por ${it.admin_nome}` : ""}
                        {it.destinatario ? ` · ${it.destinatario}` : ""}
                      </div>
                      {it.observacao && (
                        <div className="text-xs text-slate-600 mt-1 line-clamp-2">{it.observacao}</div>
                      )}
                      {it.html && (
                        <button
                          onClick={() => setPreview(it.html)}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline"
                        >
                          <Eye className="h-3 w-3" /> Ver e-mail
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {preview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <span className="text-sm font-medium">Preview do e-mail</span>
                <button onClick={() => setPreview(null)} className="p-1 hover:bg-slate-100 rounded">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <iframe title="preview" srcDoc={preview} className="flex-1 w-full min-h-[400px]" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
