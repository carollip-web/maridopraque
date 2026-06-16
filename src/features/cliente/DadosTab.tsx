import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, ShieldCheck, User, MapPin, ChevronRight, Bell } from "lucide-react";
import { type Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Endereco = {
  id: string;
  rotulo: string;
  cep: string | null;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  is_padrao: boolean;
};

const profileSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function DadosTab() {
  const { user, profile, profilePhoto, updatePhoto } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome: profile?.nome ?? "",
      whatsapp: profile?.whatsapp ?? "",
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        nome: profile.nome ?? "",
        whatsapp: profile.whatsapp ?? "",
      });
    }
  }, [profile, reset]);

  const [editingAddr, setEditingAddr] = useState<Endereco | null>(null);
  const [addrForm, setAddrForm] = useState({
    rotulo: "Casa",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  });

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
  };

  const handleSaveProfile = async (values: ProfileValues) => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: values.nome, whatsapp: values.whatsapp })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) {
      toastError("Não foi possível salvar", error.message);
      return;
    }
    setIsEditingProfile(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) toastError("Erro", error.message);
    else {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        // dynamic import of toast since it's lazy in this file or we can use toastError logic
        import("sonner").then(async (m) => {
          const toastId = m.toast.loading("Enviando foto...");
          try {
            await updatePhoto(reader.result as string);
            m.toast.success("Foto atualizada!", { id: toastId });
          } catch (err: any) {
            m.toast.error("Erro ao subir foto", { id: toastId, description: err.message });
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const resetAddrForm = () => {
    setAddrForm({
      rotulo: "Casa",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
    });
    setEditingAddr(null);
  };

  const startEditAddr = (a: Endereco) => {
    setEditingAddr(a);
    setAddrForm({
      rotulo: a.rotulo,
      cep: a.cep || "",
      logradouro: a.logradouro,
      numero: a.numero || "",
      complemento: a.complemento || "",
      bairro: a.bairro || "",
      cidade: a.cidade || "",
      uf: a.uf || "",
    });
    setIsAddingAddress(true);
  };

  const {
    data: enderecos = [],
    isLoading: loadingEnderecos,
    refetch: refetchEnderecos,
  } = useQuery({
    queryKey: ["cliente", "enderecos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("cliente_enderecos")
        .select("*")
        .eq("user_id", user.id)
        .order("is_padrao", { ascending: false })
        .order("created_at", { ascending: true });
      return (data as Tables<"enderecos">[]) || [];
    },
    enabled: !!user,
  });

  const handleSaveAddr = async () => {
    if (!user) return;
    if (!addrForm.logradouro.trim()) {
      toastError("Endereço", "Informe o logradouro");
      return;
    }
    // Geocodifica em paralelo (best-effort, não bloqueia o save em caso de falha)
    const { geocodeAddress } = await import("@/lib/geo");
    const geo = await geocodeAddress({
      logradouro: addrForm.logradouro,
      numero: addrForm.numero,
      bairro: addrForm.bairro,
      cidade: addrForm.cidade,
      uf: addrForm.uf,
      cep: addrForm.cep,
    });
    const base = {
      rotulo: addrForm.rotulo,
      cep: addrForm.cep || null,
      logradouro: addrForm.logradouro,
      numero: addrForm.numero || null,
      complemento: addrForm.complemento || null,
      bairro: addrForm.bairro || null,
      cidade: addrForm.cidade || null,
      uf: addrForm.uf || null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
    };
    if (editingAddr) {
      const { error } = await supabase
        .from("cliente_enderecos")
        .update(base)
        .eq("id", editingAddr.id);
      if (error) {
        toastError("Erro", error.message);
        return;
      }
    } else {
      const isPadrao = enderecos.length === 0;
      const { error } = await supabase.from("cliente_enderecos").insert({
        ...base,
        user_id: user.id,
        is_padrao: isPadrao,
      });
      if (error) {
        toastError("Erro", error.message);
        return;
      }
    }
    setIsAddingAddress(false);
    resetAddrForm();
    refetchEnderecos();
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("cliente_enderecos").update({ is_padrao: false }).eq("user_id", user.id);
    await supabase.from("cliente_enderecos").update({ is_padrao: true }).eq("id", id);
    refetchEnderecos();
  };

  const handleRemoveAddr = async (id: string) => {
    if (!confirm("Remover este endereço?")) return;
    await supabase.from("cliente_enderecos").delete().eq("id", id);
    refetchEnderecos();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_2fr] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sidebar */}
      <div className="space-y-6">
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft text-center">
          <div
            className="relative mx-auto w-24 h-24 mb-6 group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              className="hidden"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt="Profile"
                className="w-full h-full rounded-full object-cover border-2 border-brand/20"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-brand/10 border-2 border-brand/20 flex items-center justify-center text-brand text-3xl font-bold">
                {(profile?.nome?.[0] || profile?.email?.[0] || "?").toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 p-2 rounded-full bg-[#2a1f1d] text-white shadow-lg border-2 border-white transition group-hover:scale-110">
              <Camera className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-xl font-bold">{profile?.nome || "Cliente"}</h3>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          <div className="mt-8 pt-8 border-t border-border flex justify-around">
            <div>
              <p className="text-xl font-bold">
                {profile && profile.total_servicos_pagos != null
                  ? profile.total_servicos_pagos
                  : "—"}
              </p>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">
                Serviços pagos
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Forms */}
      <div className="space-y-8">
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-brand" />
              <h3 className="font-bold text-lg">Dados cadastrais</h3>
            </div>
            {!isEditingProfile ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-brand font-bold"
                onClick={() => setIsEditingProfile(true)}
              >
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    reset();
                    setIsEditingProfile(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={savingProfile}
                  className="bg-brand text-white rounded-full px-6 font-bold"
                  onClick={handleSubmit(handleSaveProfile)}
                >
                  {savingProfile ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            )}
          </div>

          {!isEditingProfile ? (
            <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2 animate-in fade-in duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Nome completo
                </label>
                <p className="text-lg font-medium text-slate-800">{profile?.nome || "—"}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  WhatsApp
                </label>
                <p className="text-lg font-medium text-slate-800">{profile?.whatsapp || "—"}</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  E-mail
                </label>
                <p className="text-lg font-medium text-slate-800">
                  {profile?.email || user?.email}
                </p>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(handleSaveProfile)}
              className="grid gap-x-8 gap-y-6 sm:grid-cols-2 animate-in fade-in duration-300"
            >
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Nome completo
                </label>
                <input
                  {...register("nome")}
                  className={`w-full text-sm font-medium pb-2 border-b focus:outline-none transition-colors bg-transparent ${errors.nome ? "border-red-500" : "border-brand focus:border-brand"}`}
                />
                {errors.nome && (
                  <p className="text-[10px] text-red-500 font-bold">{errors.nome.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  WhatsApp
                </label>
                <input
                  {...register("whatsapp")}
                  placeholder="+55 (21) 99999-9999"
                  className={`w-full text-sm font-medium pb-2 border-b focus:outline-none transition-colors bg-transparent ${errors.whatsapp ? "border-red-500" : "border-brand focus:border-brand"}`}
                />
                {errors.whatsapp && (
                  <p className="text-[10px] text-red-500 font-bold">{errors.whatsapp.message}</p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  E-mail
                </label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full text-sm font-medium pb-2 border-b border-border bg-transparent text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground">
                  O e-mail é o seu identificador de login e não pode ser editado por aqui.
                </p>
              </div>
            </form>
          )}
        </section>

        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-brand" />
              <h3 className="font-bold text-lg">Endereços de atendimento</h3>
            </div>
            {!isAddingAddress && (
              <Button
                onClick={() => {
                  resetAddrForm();
                  setIsAddingAddress(true);
                }}
                size="sm"
                className="rounded-full bg-brand text-white hover:bg-brand/90 font-bold px-6 h-10 shadow-md"
              >
                + Novo
              </Button>
            )}
          </div>

          {isAddingAddress && (
            <div className="mb-8 p-6 rounded-2xl border border-brand/30 bg-brand/5 animate-in fade-in duration-300">
              <h4 className="font-bold mb-4 text-brand">
                {editingAddr ? "Editar endereço" : "Adicionar novo endereço"}
              </h4>
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                <Field label="Rótulo (Ex: Casa)">
                  <input
                    value={addrForm.rotulo}
                    onChange={(e) => setAddrForm({ ...addrForm, rotulo: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border bg-white text-sm"
                    placeholder="Casa"
                  />
                </Field>
                <Field label="CEP">
                  <input
                    value={addrForm.cep}
                    onChange={(e) => setAddrForm({ ...addrForm, cep: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border bg-white text-sm"
                    placeholder="00000-000"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Logradouro">
                    <input
                      value={addrForm.logradouro}
                      onChange={(e) => setAddrForm({ ...addrForm, logradouro: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-border bg-white text-sm"
                      placeholder="Rua, Avenida…"
                    />
                  </Field>
                </div>
                <Field label="Número">
                  <input
                    value={addrForm.numero}
                    onChange={(e) => setAddrForm({ ...addrForm, numero: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border bg-white text-sm"
                    placeholder="123"
                  />
                </Field>
                <Field label="Complemento">
                  <input
                    value={addrForm.complemento}
                    onChange={(e) => setAddrForm({ ...addrForm, complemento: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border bg-white text-sm"
                    placeholder="Apto 101"
                  />
                </Field>
                <Field label="Bairro">
                  <input
                    value={addrForm.bairro}
                    onChange={(e) => setAddrForm({ ...addrForm, bairro: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border bg-white text-sm"
                  />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Field label="Cidade">
                      <input
                        value={addrForm.cidade}
                        onChange={(e) => setAddrForm({ ...addrForm, cidade: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-border bg-white text-sm"
                      />
                    </Field>
                  </div>
                  <Field label="UF">
                    <input
                      value={addrForm.uf}
                      maxLength={2}
                      onChange={(e) =>
                        setAddrForm({ ...addrForm, uf: e.target.value.toUpperCase() })
                      }
                      className="w-full p-2.5 rounded-xl border border-border bg-white text-sm uppercase"
                      placeholder="RJ"
                    />
                  </Field>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsAddingAddress(false);
                    resetAddrForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-brand text-white rounded-full font-bold px-8"
                  onClick={handleSaveAddr}
                >
                  Salvar endereço
                </Button>
              </div>
            </div>
          )}

          {loadingEnderecos && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="p-6 rounded-[1.5rem] border border-border bg-slate-50 space-y-4"
                >
                  <div className="flex justify-between">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <div className="pt-4 flex gap-4">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingEnderecos && enderecos.length === 0 && !isAddingAddress ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Você ainda não cadastrou endereços.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {!loadingEnderecos &&
                enderecos.map((addr: Endereco) => (
                  <div
                    key={addr.id}
                    className={`p-6 rounded-[1.5rem] border transition-all ${addr.is_padrao ? "border-brand/20 bg-brand-soft/30 ring-1 ring-brand/10" : "border-border bg-slate-50 hover:bg-white hover:shadow-md"}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center ${addr.is_padrao ? "bg-brand text-white" : "bg-white text-muted-foreground"}`}
                      >
                        <MapPin className="h-4 w-4" />
                      </div>
                      {addr.is_padrao && (
                        <span className="text-[10px] font-bold uppercase text-brand">Padrão</span>
                      )}
                    </div>
                    <p className="font-bold text-sm mb-1">{addr.rotulo}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {addr.logradouro}
                      {addr.numero ? `, ${addr.numero}` : ""}
                      {addr.complemento ? ` · ${addr.complemento}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {[addr.bairro, addr.cidade, addr.uf].filter(Boolean).join(", ")}
                    </p>
                    {addr.cep && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-2">{addr.cep}</p>
                    )}
                    <div className="mt-4 pt-4 border-t border-border/40 flex gap-4">
                      <button
                        className="text-[10px] font-bold uppercase text-brand hover:underline"
                        onClick={() => startEditAddr(addr)}
                      >
                        Editar
                      </button>
                      {!addr.is_padrao && (
                        <button
                          className="text-[10px] font-bold uppercase text-muted-foreground hover:text-brand hover:underline"
                          onClick={() => handleSetDefault(addr.id)}
                        >
                          Tornar padrão
                        </button>
                      )}
                      {!addr.is_padrao && (
                        <button
                          className="text-[10px] font-bold uppercase text-red-500 hover:underline ml-auto"
                          onClick={() => handleRemoveAddr(addr.id)}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      {showSuccess && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="bg-[#1a1513] text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 border border-white/10">
            <div className="h-6 w-6 bg-green-500 text-white rounded-full flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="font-bold text-sm tracking-wide">Alterações salvas com sucesso!</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-muted-foreground uppercase">{label}</label>
      {children}
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
      <div>
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
  // lazy import to avoid circular issues
  import("sonner").then((m) => m.toast.error(title, description ? { description } : undefined));
}
