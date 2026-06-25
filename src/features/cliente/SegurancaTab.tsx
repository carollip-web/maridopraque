import React, { useState, useEffect } from "react";
import { ShieldCheck, ChevronRight, Bell, Smartphone, MonitorSmartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Download, Trash2, FileJson, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { excluirMinhaConta } from "@/lib/conta.functions";

export function SegurancaTab() {
  const { user } = useAuth();
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleGlobalLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      toastError("Erro ao encerrar sessões", error.message);
    } else {
      import("sonner").then((m) => m.toast.success("Todas as sessões foram encerradas."));
      navigate({ to: "/login" });
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const [
        { data: profile },
        { data: orcamentos },
        { data: avaliacoes },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("orcamentos").select("*").eq("cliente_id", user.id),
        supabase.from("avaliacoes").select("*").eq("cliente_id", user.id),
      ]);

      const dataToExport = {
        profile,
        orcamentos,
        avaliacoes,
        exportadoEm: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados-pessoais-${user.id.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg("Dados exportados com sucesso!");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3500);
    } catch (e: any) {
      toastError("Erro ao exportar dados", e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const excluirContaFn = useServerFn(excluirMinhaConta);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "EXCLUIR" || !user) return;
    setIsDeleting(true);
    try {
      await excluirContaFn({});
      import("sonner").then((m) =>
        m.toast.success("Sua conta foi excluída permanentemente."),
      );
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (e: any) {
      toastError("Não foi possível excluir a conta", e?.message);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
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
              onClick={handleGlobalLogout}
            >
              Sair de todos os dispositivos
            </Button>
          </div>
        </div>
      </section>

      {/* Privacidade e LGPD */}
      <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-brand/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Privacidade e Dados</h3>
            <p className="text-sm text-muted-foreground">Gerencie seus dados conforme a LGPD.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[1.5rem] bg-slate-50 border border-border">
            <div>
              <p className="font-bold text-sm flex items-center gap-2">
                <FileJson className="h-4 w-4 text-muted-foreground" /> Exportar meus dados
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Conforme a LGPD, você tem direito à portabilidade dos seus dados.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-xl font-bold bg-white"
              onClick={handleExportData}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exportar JSON
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[1.5rem] bg-red-50/50 border border-red-100">
            <div>
              <p className="font-bold text-sm text-red-900 flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Excluir minha conta
              </p>
              <p className="text-xs text-red-700 mt-1 max-w-sm">
                A exclusão é permanente e imediata. Todos os seus dados pessoais serão apagados dos nossos servidores e não podem ser recuperados.
              </p>
            </div>
            <Button
              variant="destructive"
              className="rounded-xl font-bold"
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteDialogOpen(true);
              }}
            >
              Excluir conta
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Esta ação é <strong>imediata e irreversível</strong>. Sua conta e todos os seus dados serão apagados em definitivo. Se tiver pedidos em andamento, finalize-os antes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium mb-2">Para confirmar, digite EXCLUIR abaixo:</p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="EXCLUIR"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "EXCLUIR" || isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir minha conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
