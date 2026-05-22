import React, { useState, useEffect } from "react";
import { ShieldCheck, ChevronRight, Bell, Smartphone, MonitorSmartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function SegurancaTab() {
  const { user } = useAuth();
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const prefsKey = user ? `mpq_prefs_${user.id}` : null;
  const [whatsappNotifications, setWhatsappNotifications] = useState(true);
  const [promoEmails, setPromoEmails] = useState(false);

  useEffect(() => {
    if (!prefsKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(prefsKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.whatsappNotifications === "boolean")
          setWhatsappNotifications(p.whatsappNotifications);
        if (typeof p.promoEmails === "boolean") setPromoEmails(p.promoEmails);
      }
    } catch {}
  }, [prefsKey]);

  const savePrefs = (next: { whatsappNotifications?: boolean; promoEmails?: boolean }) => {
    if (!prefsKey || typeof window === "undefined") return;
    const merged = { whatsappNotifications, promoEmails, ...next };
    window.localStorage.setItem(prefsKey, JSON.stringify(merged));

    setSuccessMsg("Preferências salvas com sucesso!");
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      toastError("Erro", error.message);
    } else {
      setSuccessMsg("Link de redefinição enviado para seu e-mail!");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3500);
    }
  };

  return (
    <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      {/* Segurança */}
      <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-brand/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Segurança</h3>
            <p className="text-sm text-muted-foreground">Gerencie sua senha e acessos.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[1.5rem] bg-slate-50 border border-border">
            <div>
              <p className="font-bold text-sm">Senha da conta</p>
              <p className="text-xs text-muted-foreground mt-1">
                Para alterar sua senha, enviaremos um link seguro para seu e-mail cadastrado.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-xl font-bold bg-white"
              onClick={handleResetPassword}
            >
              Redefinir senha
            </Button>
          </div>

          {/* Dispositivos Ativos (Mock para LGPD) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[1.5rem] bg-slate-50 border border-border">
            <div>
              <p className="font-bold text-sm flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-muted-foreground" /> Sessões Ativas
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Você está conectado neste dispositivo atualmente.
              </p>
            </div>
            <Button
              variant="ghost"
              className="rounded-xl font-bold text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Sair de todos os dispositivos
            </Button>
          </div>
        </div>
      </section>

      {/* Notificações */}
      <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-brand/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Preferências de contato</h3>
            <p className="text-sm text-muted-foreground">O que você deseja receber.</p>
          </div>
        </div>

        <div className="space-y-4">
          <Toggle
            label="Notificações via WhatsApp"
            desc="Avisos importantes de agendamento, orçamentos e mensagens de profissionais."
            value={whatsappNotifications}
            onChange={(v) => {
              setWhatsappNotifications(v);
              savePrefs({ whatsappNotifications: v });
            }}
          />
          <Toggle
            label="E-mails de promoção e dicas"
            desc="Receba cupons de desconto, novidades e dicas de manutenção residencial."
            value={promoEmails}
            onChange={(v) => {
              setPromoEmails(v);
              savePrefs({ promoEmails: v });
            }}
          />
        </div>
      </section>

      {/* Sucesso */}
      {showSuccess && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="bg-[#1a1513] text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 border border-white/10">
            <div className="h-6 w-6 bg-green-500 text-white rounded-full flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="font-bold text-sm tracking-wide">{successMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between p-6 rounded-[1.5rem] bg-slate-50/50 border border-slate-100 hover:border-brand/10 transition-colors cursor-pointer group"
      onClick={() => onChange(!value)}
    >
      <div className="pr-4">
        <p className="text-sm font-bold group-hover:text-brand transition-colors">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${value ? "bg-[#b85c45]" : "bg-slate-200"}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${value ? "translate-x-5" : "translate-x-0"}`}
        />
      </div>
    </div>
  );
}

function toastError(title: string, description?: string) {
  import("sonner").then((m) => m.toast.error(title, description ? { description } : undefined));
}
