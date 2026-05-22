import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, Loader2, Trash2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { convidarAdminFn } from "@/lib/usuarios.functions";
import { ADMIN_LEVEL_LABELS, AdminLevel } from "./constants";

export function AdminEquipe() {
  const { user, session } = useAuth();
  const qc = useQueryClient();
  const convidarFn = useServerFn(convidarAdminFn);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLevel, setInviteLevel] = useState<NonNullable<AdminLevel>>("suporte");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [changingLevel, setChangingLevel] = useState<string | null>(null);

  const { data: team = [], isLoading } = useQuery({
    queryKey: ["admin", "equipe"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, admin_level")
        .eq("role", "admin");
      if (!roles?.length) return [];
      const ids = roles.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      return (profiles || []).map((p: any) => ({
        ...p,
        admin_level: roles.find((r: any) => r.user_id === p.id)?.admin_level ?? null,
      }));
    },
  });

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    try {
      const result = await convidarFn({
        data: {
          email,
          admin_level: inviteLevel,
          redirectTo: `${window.location.origin}/auth/redirect`,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (result.alreadyAdmin) {
        toast.success("Nível atualizado", {
          description: `${email} agora é ${ADMIN_LEVEL_LABELS[inviteLevel].label}.`,
        });
      } else if (result.invited) {
        toast.success("Convite enviado!", {
          description: `Enviamos um e-mail para ${email} definir a senha. Acesso já como ${ADMIN_LEVEL_LABELS[inviteLevel].label}.`,
        });
      } else {
        toast.success("Administrador adicionado!", {
          description: `${email} agora é ${ADMIN_LEVEL_LABELS[inviteLevel].label}.`,
        });
      }
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["admin", "equipe"] });
    } catch (e: any) {
      toast.error("Erro ao convidar", { description: e.message });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string, memberEmail: string) => {
    if (memberId === user?.id) {
      toast.error("Você não pode remover a si mesmo.");
      return;
    }
    if (!confirm(`Remover acesso de admin de ${memberEmail}?`)) return;
    setRemoving(memberId);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", memberId)
      .eq("role", "admin");
    setRemoving(null);
    if (error) {
      toast.error("Erro ao remover", { description: error.message });
      return;
    }
    toast.success("Acesso removido.");
    qc.invalidateQueries({ queryKey: ["admin", "equipe"] });
  };

  const handleChangeLevel = async (memberId: string, newLevel: NonNullable<AdminLevel>) => {
    setChangingLevel(memberId);
    const { error } = await supabase
      .from("user_roles")
      .update({ admin_level: newLevel })
      .eq("user_id", memberId)
      .eq("role", "admin");
    setChangingLevel(null);
    if (error) {
      toast.error("Erro ao atualizar nível", { description: error.message });
      return;
    }
    toast.success("Nível atualizado com sucesso.");
    qc.invalidateQueries({ queryKey: ["admin", "equipe"] });
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold">Equipe Administrativa</h2>
        <p className="text-sm text-slate-500 mt-1">
          Gerencie quem tem acesso ao painel e com quais permissões.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          Object.entries(ADMIN_LEVEL_LABELS) as [
            NonNullable<AdminLevel>,
            (typeof ADMIN_LEVEL_LABELS)[keyof typeof ADMIN_LEVEL_LABELS],
          ][]
        ).map(([level, meta]) => (
          <div
            key={level}
            className={`p-4 rounded-xl border flex items-start gap-3 ${meta.color.replace("text-", "border-").split(" ")[0]}/20 bg-white`}
          >
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}
            >
              <meta.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-sm">{meta.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {level === "super_admin" && "Acesso total ao painel"}
                {level === "admin" && "Gestão operacional"}
                {level === "financeiro" && "Dashboard e financeiro"}
                {level === "suporte" && "Pedidos e clientes (leitura)"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <h3 className="font-bold mb-1 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-brand" /> Adicionar Administrador
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Se ainda não tem conta, enviamos um convite por e-mail para definir a senha.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="flex-1 p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand/20 outline-none"
          />
          <select
            value={inviteLevel}
            onChange={(e) => setInviteLevel(e.target.value as NonNullable<AdminLevel>)}
            className="p-3 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-brand/20 outline-none"
          >
            <option value="suporte">Suporte</option>
            <option value="financeiro">Financeiro</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <Button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="bg-brand text-white rounded-lg px-6 font-bold"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
          </Button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold">{team.length} administradores</h3>
          <Lock className="h-4 w-4 text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            ))}
          {!isLoading &&
            team.map((member: any) => {
              const meta = member.admin_level
                ? ADMIN_LEVEL_LABELS[member.admin_level as NonNullable<AdminLevel>]
                : null;
              const isSelf = member.id === user?.id;
              return (
                <div
                  key={member.id}
                  className={`px-8 py-5 flex items-center justify-between gap-4 ${isSelf ? "bg-brand/5" : "hover:bg-slate-50"} transition-colors`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {(member.nome || member.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{member.nome || member.email}</p>
                        {isSelf && (
                          <span className="text-[9px] font-bold uppercase text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                            Você
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      {meta && (
                        <span
                          className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${meta.color}`}
                        >
                          <meta.icon className="h-2.5 w-2.5" />
                          {meta.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={member.admin_level ?? ""}
                      disabled={changingLevel === member.id}
                      onChange={(e) =>
                        handleChangeLevel(member.id, e.target.value as NonNullable<AdminLevel>)
                      }
                      className="text-xs p-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-brand/20 outline-none"
                    >
                      <option value="suporte">Suporte</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={removing === member.id || isSelf}
                      onClick={() => handleRemove(member.id, member.email)}
                      className={`rounded-lg px-3 ${isSelf ? "text-slate-300 cursor-not-allowed" : "text-red-500 hover:bg-red-50 hover:text-red-600"}`}
                      title={isSelf ? "Você não pode remover a si mesmo" : "Remover acesso"}
                    >
                      {removing === member.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
