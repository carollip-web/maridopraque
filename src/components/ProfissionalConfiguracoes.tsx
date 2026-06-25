import React, { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  ShieldCheck,
  Briefcase,
  Camera,
  Loader2,
  Info,
  CheckCircle2,
  AlertCircle,
  IdCard,
  Users,
  MapPin,
  Save,
  Wallet,
  Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { excluirMinhaConta } from "@/lib/conta.functions";
import { useNavigate } from "@tanstack/react-router";

const ESPECIALIDADES_LABEL: Record<string, string> = {
  chaveiro: "Chaveiro",
  "elétrica": "Elétrica",
  engenharia: "Engenharia",
  "hidráulica": "Hidráulica",
  "instalação": "Instalação",
  montagem: "Montagem de Móveis",
  reparos: "Reparos Gerais",
};

const profileSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  bio: z.string().optional(),
  cidade: z.string().optional(),
  cpf: z.string().optional().refine(val => !val || val.replace(/\D/g, "").length === 11, "CPF incompleto"),
  cnpj: z.string().optional().refine(val => !val || val.replace(/\D/g, "").length === 14, "CNPJ incompleto"),
  anos_experiencia: z.coerce.number().min(0).optional(),
  raio_atendimento_km: z.coerce.number().min(0).optional(),
  atende_emergencias: z.boolean().optional(),
  veiculo_proprio: z.boolean().optional(),
  genero: z.enum(["homem", "mulher", "outro", "nao_informar"]).optional(),
  chave_pix: z.string().optional(),
  pix_key_type: z.string().optional(),
}).superRefine((_val, _ctx) => {
});

type ProfileValues = z.infer<typeof profileSchema>;

type ProfissionalPerfilData = {
  bio: string | null;
  cidade: string | null;
  especialidades: string[] | null;
  cpf?: string | null;
  cnpj?: string | null;
  anos_experiencia?: number | null;
  raio_atendimento_km?: number | null;
  atende_emergencias?: boolean | null;
  veiculo_proprio?: boolean | null;
  genero?: "homem" | "mulher" | "outro" | "nao_informar" | null;
  mp_user_id?: string | null;
  mp_connected_at?: string | null;
  chave_pix?: string | null;
  pix_key_type?: string | null;
  slug?: string | null;
};

function fmtCnpj(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function fmtCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})/, ".$1-$2");
}

function fmtPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function fmtDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) return fmtCpf(v);
  return fmtCnpj(v);
}

function isValidCnpj(v: string) {
  const c = v.replace(/\D/g, "");
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string, pesos: number[]) => {
    const sum = pesos.reduce((acc, p, i) => acc + parseInt(base[i], 10) * p, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(c.slice(0, 12), p1);
  const d2 = calc(c.slice(0, 12) + d1, p2);
  return d1 === parseInt(c[12], 10) && d2 === parseInt(c[13], 10);
}

const inputBase =
  "w-full text-sm font-medium px-3.5 py-2.5 rounded-xl border bg-white transition-all focus:outline-none focus:ring-2 focus:ring-brand/20";
const inputOk = "border-border focus:border-brand";
const inputErr = "border-red-400 focus:border-red-500 focus:ring-red-200";
const labelCls =
  "text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5";

export function ProfissionalConfiguracoes() {
  const { user, profile, profilePhoto, updatePhoto } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("basico");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const excluirContaFn = useServerFn(excluirMinhaConta);

  const { data: profissionalPerfil, refetch: refetchPerfil } = useQuery({
    queryKey: ["profissional_perfil", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profissional_perfil")
        .select(
          "user_id, bio, cidade, especialidades, chave_pix, pix_key_type, pix_holder_name, pix_holder_document, anos_experiencia, raio_atendimento_km, atende_emergencias, veiculo_proprio, genero, ativo, lat, lng, cpf, cnpj, mp_user_id, mp_connected_at, slug",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) console.error("[ProfissionalConfiguracoes] load perfil", error);
      return data as unknown as ProfissionalPerfilData | null;
    },
    enabled: !!user,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome: profile?.nome ?? "",
      whatsapp: profile?.whatsapp ?? "",
      bio: "",
      cidade: "",
      cpf: "",
      cnpj: "",
      anos_experiencia: 0,
      raio_atendimento_km: 15,
      atende_emergencias: false,
      veiculo_proprio: false,
      genero: "nao_informar",
      chave_pix: "",
      pix_key_type: "cpf",
    },
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      nome: profile.nome ?? "",
      whatsapp: profile.whatsapp ? fmtPhone(profile.whatsapp) : "",
      bio: profissionalPerfil?.bio ?? "",
      cidade: profissionalPerfil?.cidade ?? "",
      cpf: profissionalPerfil?.cpf ? fmtCpf(profissionalPerfil.cpf) : "",
      cnpj: profissionalPerfil?.cnpj ? fmtCnpj(profissionalPerfil.cnpj) : "",
      anos_experiencia: profissionalPerfil?.anos_experiencia ?? 0,
      raio_atendimento_km: profissionalPerfil?.raio_atendimento_km ?? 15,
      atende_emergencias: !!profissionalPerfil?.atende_emergencias,
      veiculo_proprio: !!profissionalPerfil?.veiculo_proprio,
      genero: profissionalPerfil?.genero ?? "nao_informar",
      chave_pix: profissionalPerfil?.chave_pix ?? "",
      pix_key_type: profissionalPerfil?.pix_key_type ?? "cpf",
    });
  }, [profile, profissionalPerfil, reset]);

  const watched = watch();
  const completeness = useMemo(() => {
    const checks = [
      !!watched.nome && watched.nome.length >= 2,
      !!watched.whatsapp && watched.whatsapp.replace(/\D/g, "").length >= 10,
      !!profilePhoto,
      !!watched.bio && watched.bio.length > 10,
      !!watched.cpf && watched.cpf.replace(/\D/g, "").length === 11,
      !!profissionalPerfil?.especialidades && profissionalPerfil.especialidades.length > 0,
      !!profissionalPerfil?.mp_user_id
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [watched, profilePhoto, profissionalPerfil]);

  const saveProfileMutation = useMutation({
    mutationFn: async (values: ProfileValues) => {
      if (!user) throw new Error("Sem usuário");
      if (values.cnpj && !isValidCnpj(values.cnpj)) {
        throw new Error("CNPJ inválido — confira os dígitos");
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ nome: values.nome, whatsapp: values.whatsapp })
        .eq("id", user.id);
      if (profileError) throw profileError;

      let geo: { lat: number; lng: number } | null = null;
      if (values.cidade?.trim()) {
        try {
          const { geocodeCidade } = await import("@/lib/geo");
          geo = await geocodeCidade(values.cidade);
        } catch (e) {
          console.warn("[ProfissionalConfiguracoes] geocoding failed", e);
        }
      }

      const profissionalPayload = {
        user_id: user.id,
        bio: values.bio || null,
        cidade: values.cidade || null,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        cpf: values.cpf ? values.cpf.replace(/\D/g, "") : null,
        cnpj: values.cnpj ? values.cnpj.replace(/\D/g, "") : null,
        anos_experiencia: Number(values.anos_experiencia ?? 0),
        raio_atendimento_km: Number(values.raio_atendimento_km ?? 15),
        atende_emergencias: !!values.atende_emergencias,
        veiculo_proprio: !!values.veiculo_proprio,
        genero: values.genero || "nao_informar",
        chave_pix: values.chave_pix || null,
        pix_key_type: values.pix_key_type || null,
        updated_at: new Date().toISOString(),
      };

      const { error: perfilError } = await supabase
        .from("profissional_perfil")
        .upsert(profissionalPayload, { onConflict: "user_id" });
      if (perfilError) {
        console.error(
          "[ProfissionalConfiguracoes] erro ao salvar profissional_perfil",
          {
            code: perfilError.code,
            message: perfilError.message,
            details: perfilError.details,
            hint: perfilError.hint,
            payload: profissionalPayload,
          },
        );
        throw perfilError;
      }

      const { data: savedPerfil } = await supabase
        .from("profissional_perfil")
        .select(
          "genero, anos_experiencia, raio_atendimento_km, chave_pix",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      return {
        confirmed:
          !savedPerfil ||
          savedPerfil.genero === profissionalPayload.genero,
      };
    },
    onSuccess: ({ confirmed }) => {
      if (confirmed) {
        toast.success("Perfil salvo com sucesso!");
      } else {
        toast.error("Perfil enviado, mas os dados não foram confirmados no banco.");
      }
      // Invalida tanto o cache local quanto o do painel profissional
      queryClient.invalidateQueries({
        queryKey: ["profissional_perfil", user?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["profissional", "perfil", user?.id],
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    },
    onError: (error: any) => {
      console.error("[ProfissionalConfiguracoes] erro ao salvar perfil", error);
      toast.error("Erro ao salvar perfil", { description: error.message });
    },
  });

  const saving = saveProfileMutation.isPending;
  const handleSaveProfile = (values: ProfileValues) =>
    saveProfileMutation.mutate(values);

  const onInvalid = (errs: typeof errors) => {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    const map: Record<string, string> = {
      nome: "basico",
      whatsapp: "basico",
      bio: "basico",
      cidade: "basico",
      cpf: "documentos",
      cnpj: "documentos",
    };
    setActiveSection(map[firstKey] ?? "basico");
    toast.error("Confira os campos destacados antes de salvar.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const toastId = toast.loading("Enviando foto...");
        try {
          await updatePhoto(reader.result as string);
          toast.success("Foto atualizada!", { id: toastId });
        } catch (err: any) {
          toast.error("Erro ao subir foto", { id: toastId, description: err.message });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) toast.error("Erro", { description: error.message });
    else toast.success("E-mail de redefinição enviado!");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "EXCLUIR" || !user) return;
    setIsDeleting(true);
    try {
      await excluirContaFn({});
      toast.success("Sua conta foi excluída permanentemente.");
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error("Não foi possível excluir a conta", { description: e?.message });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleConnectMercadoPago = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("mercado-pago-oauth-start");

      if (error) {
        let errorBody = error.message || "Erro desconhecido";
        if (error.context) {
          try {
            const parsed = await error.context.json();
            errorBody = parsed.error || JSON.stringify(parsed);
          } catch {
            errorBody = error.message || "Erro ao processar resposta do servidor";
          }
        }
        console.error("MP Connect Error:", error);
        toast.error("Erro do Servidor", { description: errorBody });
        return;
      }

      const targetUrl = data?.authUrl;
      
      if (!targetUrl) {
        toast.error("Erro ao iniciar conexão com Mercado Pago", { 
          description: `URL de auth não retornada. Resposta: ${JSON.stringify(data)}` 
        });
        return;
      }
      
      window.location.href = targetUrl;
    } catch (err: any) {
      toast.error("Erro ao iniciar conexão", { description: err.message });
    }
  };

  const sections = [
    { id: "basico", label: "Perfil básico", icon: User },
    { id: "documentos", label: "Documentos", icon: IdCard },
    { id: "mercadopago", label: "Mercado Pago", icon: Wallet },
    { id: "atendimento", label: "Atendimento", icon: MapPin },
    { id: "compatibilidade", label: "Compatibilidade", icon: Users },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr] animate-in fade-in duration-500 pb-28">
      {/* Sidebar */}
      <aside className="space-y-6 lg:sticky lg:top-6 self-start">
        <section className="bg-white rounded-3xl border border-border p-6 shadow-sm text-center">
          <div
            className="relative mx-auto w-24 h-24 mb-4 group cursor-pointer"
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
          <h3 className="text-lg font-bold leading-tight">{profile?.nome || "Profissional"}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile?.email}</p>

          {/* Completude */}
          <div className="mt-5 text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Completude
              </span>
              <span className="text-xs font-bold text-brand">{completeness}%</span>
            </div>
            <div className="h-2 rounded-full bg-brand/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand to-brand/70 transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              {completeness === 100
                ? "Perfil completo — pronto para receber clientes."
                : "Preencha todos os campos para destacar seu perfil."}
            </p>
          </div>
        </section>

        {/* Section nav */}
        <nav className="bg-white rounded-3xl border border-border p-3 shadow-sm hidden lg:block">
          {sections.map((s) => {
            const Icon = s.icon;
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setActiveSection(s.id);
                  document
                    .getElementById(`sec-${s.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
        </nav>

        <section className="bg-white rounded-3xl border border-border p-6 shadow-sm">
          <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand" /> Segurança
          </h4>
          <Button
            variant="outline"
            className="w-full rounded-xl text-xs font-bold"
            onClick={handleResetPassword}
          >
            Redefinir senha
          </Button>
          <p className="text-[11px] text-muted-foreground mt-2 text-center leading-relaxed">
            Um link será enviado para o seu e-mail.
          </p>
        </section>
      </aside>

      {/* Main Form */}
      <form
        onSubmit={handleSubmit(handleSaveProfile, onInvalid)}
        className="space-y-6"
      >
        {/* Header card */}
        <header className="bg-gradient-to-br from-brand/5 via-white to-white border border-brand/10 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-brand/10 flex items-center justify-center shrink-0">
              <Briefcase className="h-6 w-6 text-brand" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Configurações do perfil profissional
              </h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Mantenha seus dados sempre atualizados para receber mais pedidos e seus repasses
                sem atraso.
              </p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-brand/10">
            {profissionalPerfil?.slug ? (
              <a 
                href={`/profissionais/perfil/${profissionalPerfil.slug}`} 
                target="_blank" 
                rel="noreferrer"
                className="text-sm font-bold text-brand hover:underline"
              >
                Ver meu perfil público ↗
              </a>
            ) : (
              <span className="text-sm text-slate-500 font-medium">
                Complete seu perfil para ter uma página pública
              </span>
            )}
          </div>
        </header>

        {/* Seção: Básico */}
        <section
          id="sec-basico"
          className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-sm scroll-mt-6"
        >
          <SectionTitle icon={User} title="Perfil básico" hint="Como você aparece para clientes." />

          <div className="grid gap-5 sm:grid-cols-2 mt-6">
            <Field label="Nome de exibição" error={errors.nome?.message} required>
              <input
                {...register("nome")}
                className={`${inputBase} ${errors.nome ? inputErr : inputOk}`}
                placeholder="Como os clientes te chamam"
              />
            </Field>

            <Field label="WhatsApp profissional" error={errors.whatsapp?.message} required>
              <input
                value={watch("whatsapp") || ""}
                onChange={(e) =>
                  setValue("whatsapp", fmtPhone(e.target.value), { shouldDirty: true })
                }
                className={`${inputBase} ${errors.whatsapp ? inputErr : inputOk}`}
                placeholder="(11) 90000-0000"
                inputMode="numeric"
              />
            </Field>

            <Field
              label="Bio / sobre você"
              hint="Conta sua experiência e diferenciais (max. 280 caracteres)."
              className="sm:col-span-2"
            >
              <textarea
                {...register("bio")}
                maxLength={280}
                className={`${inputBase} ${inputOk} resize-none min-h-[90px]`}
                placeholder="Ex: Trabalho com elétrica há 10 anos, especialista em instalações residenciais..."
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground text-right mt-1">
                {(watch("bio") || "").length}/280
              </p>
            </Field>

            <Field
              label="Cidade de atendimento"
              hint="Usada para mostrar pedidos próximos."
              className="sm:col-span-2"
            >
              <input
                {...register("cidade")}
                className={`${inputBase} ${inputOk}`}
                placeholder="Ex: São Paulo - SP"
              />
            </Field>
          </div>
        </section>

        {/* Seção: Documentos */}
        <section
          id="sec-documentos"
          className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-sm scroll-mt-6"
        >
          <SectionTitle
            icon={IdCard}
            title="Documentos"
            hint="Usados para emissão de notas e validação cadastral."
          />

          <div className="grid gap-5 sm:grid-cols-2 mt-6">
            <Field label="CPF" error={errors.cpf?.message} required>
              <input
                value={watch("cpf") || ""}
                onChange={(e) =>
                  setValue("cpf", fmtCpf(e.target.value), { shouldDirty: true })
                }
                className={`${inputBase} ${errors.cpf ? inputErr : inputOk}`}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </Field>

            <Field label="CNPJ (opcional)" error={errors.cnpj?.message}>
              <input
                value={watch("cnpj") || ""}
                onChange={(e) =>
                  setValue("cnpj", fmtCnpj(e.target.value), { shouldDirty: true })
                }
                className={`${inputBase} ${errors.cnpj ? inputErr : inputOk}`}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
            </Field>
          </div>
        </section>

        {/* Seção: Mercado Pago */}
        <section
          id="sec-mercadopago"
          className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-sm scroll-mt-6"
        >
          <SectionTitle
            icon={Wallet}
            title="Conta Mercado Pago"
            hint="Necessário para receber os repasses dos seus serviços."
          />

          <div className="mt-6">
            {profissionalPerfil?.mp_user_id ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-green-50 border border-green-200 rounded-2xl">
                <div>
                  <h4 className="font-bold text-green-900 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Conta Mercado Pago conectada
                  </h4>
                  <p className="text-sm text-green-800 mt-1">
                    Conectada em: {profissionalPerfil.mp_connected_at ? new Date(profissionalPerfil.mp_connected_at).toLocaleDateString() : "Data desconhecida"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white text-green-800 border-green-200 hover:bg-green-100"
                  onClick={handleConnectMercadoPago}
                >
                  Reconectar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
                <div>
                  <h4 className="font-bold text-amber-900 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    Atenção
                  </h4>
                  <p className="text-sm text-amber-800 mt-1">
                    Conecte sua conta Mercado Pago para receber pagamentos dos serviços.
                  </p>
                </div>
                <Button
                  type="button"
                  className="bg-[#009EE3] hover:bg-[#008ACA] text-white font-bold"
                  onClick={handleConnectMercadoPago}
                >
                  Conectar Mercado Pago
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Seção: Atendimento */}
        <section
          id="sec-atendimento"
          className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-sm scroll-mt-6"
        >
          <SectionTitle
            icon={MapPin}
            title="Atendimento"
            hint="Defina sua experiência e preferências de atendimento."
          />

          <div className="grid gap-5 sm:grid-cols-2 mt-6">
            <Field label="Anos de experiência">
              <input
                type="number"
                {...register("anos_experiencia")}
                className={`${inputBase} ${inputOk}`}
                placeholder="Ex: 5"
                min="0"
              />
            </Field>

            <Toggle
              label="Atende emergências"
              hint="Aparece com prioridade em pedidos urgentes."
              {...register("atende_emergencias")}
            />

            <Toggle
              label="Veículo próprio"
              hint="Indica que você pode levar materiais e ferramentas."
              {...register("veiculo_proprio")}
            />
          </div>
        </section>

        {/* Seção: Compatibilidade */}
        <section
          id="sec-compatibilidade"
          className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-sm scroll-mt-6"
        >
          <SectionTitle
            icon={Users}
            title="Compatibilidade de atendimento"
            hint="Ajuda a mostrar pedidos compatíveis com a preferência das clientes."
          />

          <div className="mt-6">
            <Field label="Gênero para atendimento" hint="Apenas para compatibilidade operacional.">
              <select {...register("genero")} className={`${inputBase} ${inputOk}`}>
                <option value="nao_informar">Prefiro não informar</option>
                <option value="mulher">Mulher</option>
                <option value="homem">Homem</option>
                <option value="outro">Outro</option>
              </select>
            </Field>
          </div>
        </section>

        {/* Especialidades (read-only) */}
        <section className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-sm">
          <SectionTitle
            icon={Briefcase}
            title="Especialidades"
            hint="Definem quais pedidos você recebe."
          />

          <div className="mt-6">
            {profissionalPerfil?.especialidades && profissionalPerfil.especialidades.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profissionalPerfil.especialidades.map((esp: string) => (
                  <span
                    key={esp}
                    className="px-3 py-1.5 bg-brand-soft text-brand-foreground text-xs font-bold rounded-full"
                  >
                    {ESPECIALIDADES_LABEL[esp] ?? esp}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma especialidade cadastrada.</p>
            )}

            <div className="mt-5 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Suas especialidades definem quais pedidos você recebe. Para alterá-las,{" "}
                <strong>entre em contato com o suporte</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* Sticky save bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-border shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.08)]">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              {isDirty ? (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">Você tem alterações não salvas</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium hidden sm:inline">Tudo salvo</span>
                </>
              )}
            </div>
            <Button
              type="submit"
              disabled={saving}
              className="bg-brand text-white rounded-full px-6 sm:px-8 font-bold gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : showSuccess ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {showSuccess ? "Salvo!" : saving ? "Salvando..." : "Salvar perfil"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------- helpers ---------- */

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-brand" />
      </div>
      <div>
        <h3 className="font-bold text-base sm:text-lg text-slate-900">{title}</h3>
        {hint && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label className={labelCls}>
        {label}
        {required && <span className="text-brand">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-red-500 font-bold flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

type ToggleProps = { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>;
const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, hint, ...inputProps }, ref) => (
    <label className="flex items-start justify-between gap-3 p-4 bg-slate-50 border border-border rounded-xl cursor-pointer hover:border-brand/30 transition-colors">
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-800">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{hint}</p>}
      </div>
      <input
        type="checkbox"
        ref={ref}
        {...inputProps}
        className="h-5 w-5 accent-brand cursor-pointer shrink-0 mt-0.5"
      />
    </label>
  ),
);
Toggle.displayName = "Toggle";
