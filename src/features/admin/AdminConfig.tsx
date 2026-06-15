import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, ShieldCheck, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ADMIN_LEVEL_LABELS } from "./constants";

const profileSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function AdminConfig() {
  const { user, profile, profilePhoto, updatePhoto, adminLevel } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const trocarSenha = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      import("sonner").then((m) => m.toast.error("Erro", { description: error.message }));
    } else {
      import("sonner").then((m) =>
        m.toast.success("E-mail de redefinição enviado", {
          description: user.email,
        }),
      );
    }
  };

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

  const handleSaveProfile = async (values: ProfileValues) => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: values.nome, whatsapp: values.whatsapp })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) {
      import("sonner").then((m) => m.toast.error("Não foi possível salvar", { description: error.message }));
      return;
    }
    setIsEditingProfile(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
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

  const levelInfo = adminLevel ? ADMIN_LEVEL_LABELS[adminLevel] : null;
  const LevelIcon = levelInfo?.icon || ShieldCheck;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_2fr] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sidebar */}
      <div className="space-y-6">
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-sm text-center">
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
                className="w-full h-full rounded-full object-cover border-2 border-slate-200"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-500 text-3xl font-bold">
                {(profile?.nome?.[0] || profile?.email?.[0] || "?").toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 p-2 rounded-full bg-slate-900 text-white shadow-lg border-2 border-white transition group-hover:scale-110">
              <Camera className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-xl font-bold">{profile?.nome || "Admin"}</h3>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          
          <div className="mt-6 pt-6 border-t border-slate-100 flex justify-center">
            {levelInfo ? (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${levelInfo.color}`}>
                <LevelIcon className="h-4 w-4" />
                {levelInfo.label}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                <ShieldCheck className="h-4 w-4" />
                Admin
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Forms */}
      <div className="space-y-8">
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-slate-700" />
              <h3 className="font-bold text-lg">Dados cadastrais</h3>
            </div>
            {!isEditingProfile ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-600 font-bold hover:text-slate-900"
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
                  className="bg-slate-900 text-white hover:bg-slate-800 rounded-full px-6 font-bold"
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
                  className={`w-full text-sm font-medium pb-2 border-b focus:outline-none transition-colors bg-transparent ${errors.nome ? "border-red-500" : "border-slate-300 focus:border-slate-800"}`}
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
                  className={`w-full text-sm font-medium pb-2 border-b focus:outline-none transition-colors bg-transparent ${errors.whatsapp ? "border-red-500" : "border-slate-300 focus:border-slate-800"}`}
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

        {/* Segurança Section */}
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-sm">
          <h3 className="font-bold text-lg mb-2 text-slate-900">Segurança</h3>
          <p className="text-sm text-slate-500 mb-6">
            Enviaremos um link para <strong>{user?.email}</strong> para você definir uma nova senha.
          </p>
          <Button variant="outline" className="rounded-full font-bold px-6 border-slate-300 hover:bg-slate-50 text-slate-700" onClick={trocarSenha}>
            Enviar link de redefinição
          </Button>
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
