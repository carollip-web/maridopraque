import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { contarContatosLote } from "@/lib/admin-contato-log.functions";
import { Mail, MessageCircle, History } from "lucide-react";
import { ContatoHistoricoDialog } from "./ContatoHistoricoDialog";

export function ContatoBadge({
  userId,
  email,
  nome,
  refreshKey,
}: {
  userId?: string | null;
  email?: string | null;
  nome?: string | null;
  refreshKey?: number;
}) {
  const contar = useServerFn(contarContatosLote);
  const [counts, setCounts] = useState<{ emails: number; whatsapp: number; ultimo: string | null } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!email && !userId) return;
    let alive = true;
    contar({
      data: {
        emails: email ? [email] : [],
        user_ids: userId ? [userId] : [],
      },
    })
      .then((r: any) => {
        if (!alive) return;
        const key = email || userId || "";
        setCounts(r?.counts?.[key] ?? { emails: 0, whatsapp: 0, ultimo: null });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [email, userId, refreshKey, contar]);

  const total = (counts?.emails ?? 0) + (counts?.whatsapp ?? 0);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-600"
        title="Histórico de contatos"
      >
        <History className="h-3 w-3" />
        {total === 0 ? (
          <span className="text-slate-400">Sem contatos</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-0.5">
              <Mail className="h-3 w-3 text-blue-500" />
              {counts?.emails ?? 0}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3 text-emerald-500" />
              {counts?.whatsapp ?? 0}
            </span>
          </>
        )}
      </button>
      {open && (
        <ContatoHistoricoDialog
          open={open}
          onOpenChange={setOpen}
          destinatarioUserId={userId ?? null}
          destinatarioEmail={email ?? null}
          nome={nome ?? null}
        />
      )}
    </>
  );
}
