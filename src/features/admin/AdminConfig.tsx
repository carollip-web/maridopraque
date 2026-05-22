import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ADMIN_LEVEL_LABELS } from "./constants";

export function AdminConfig() {
  const { profile, user, adminLevel } = useAuth();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [simulando, setSimulando] = useState(false);

  const trocarSenha = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) toast.error("Erro", { description: error.message });
    else
      toast.success("E-mail de redefinição enviado", {
        description: user.email,
      });
  };

  const levelMeta = adminLevel ? ADMIN_LEVEL_LABELS[adminLevel] : null;
  const initials = (profile?.nome || user?.email || "AD")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-2xl space-y-6 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold">Configurações da conta</h2>

      <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-slate-800 text-white flex items-center justify-center text-xl font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold truncate">{profile?.nome || "—"}</p>
            <p className="text-sm text-slate-500 truncate">{user?.email}</p>
            {profile?.whatsapp && <p className="text-sm text-slate-500">{profile.whatsapp}</p>}
            {levelMeta && (
              <span
                className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${levelMeta.color}`}
              >
                <levelMeta.icon className="h-3 w-3" />
                {levelMeta.label}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            className="rounded-xl font-bold shrink-0 flex items-center gap-2"
            onClick={() => navigate({ to: "/cliente", search: { tab: "dados" } as any })}
          >
            <ArrowUpRight className="h-4 w-4" />
            Editar perfil
          </Button>
        </div>
        <p className="mt-6 text-xs text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Para editar nome, WhatsApp e foto, acesse a área do cliente — os dados são compartilhados
          entre os dois painéis.
        </p>
      </section>

      <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold mb-2 text-slate-900">Segurança</h3>
        <p className="text-sm text-slate-500 mb-4">
          Enviaremos um link para <strong>{user?.email}</strong> para você definir uma nova senha.
        </p>
        <Button variant="outline" className="rounded-lg" onClick={trocarSenha}>
          Enviar link de redefinição de senha
        </Button>
      </section>
    </div>
  );
}
