import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, ShieldCheck, Briefcase, Camera, Loader2, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const profileSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  bio: z.string().optional(),
  cidade: z.string().optional(),
  chave_pix: z.string().min(1, "Chave Pix obrigatória"),
  pix_key_type: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"], {
    errorMap: () => ({ message: "Selecione o tipo da chave" }),
  }),
  pix_holder_name: z.string().min(2, "Nome do titular obrigatório"),
  pix_holder_document: z.string().min(11, "Documento do titular obrigatório"),
  cpf: z.string().min(14, "CPF obrigatório"),
  cnpj: z.string().min(18, "CNPJ obrigatório"),
  anos_experiencia: z.coerce.number().min(0).optional(),
  raio_atendimento_km: z.coerce.number().min(0).optional(),
  atende_emergencias: z.boolean().optional(),
  veiculo_proprio: z.boolean().optional(),
  genero: z.enum(["homem", "mulher", "outro", "nao_informar"]).optional(),
  oferece_apoio_feminino: z.boolean().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

type ProfissionalPerfilData = {
  bio: string | null;
  cidade: string | null;
  especialidades: string[] | null;
  chave_pix?: string | null;
  pix_key_type?: string | null;
  pix_holder_name?: string | null;
  pix_holder_document?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  anos_experiencia?: number | null;
  raio_atendimento_km?: number | null;
  atende_emergencias?: boolean | null;
  veiculo_proprio?: boolean | null;
  genero?: string | null;
  oferece_apoio_feminino?: boolean | null;
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

export function ProfissionalConfiguracoes() {
  const { user, profile, profilePhoto, updatePhoto } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: profissionalPerfil, refetch: refetchPerfil } = useQuery({
    queryKey: ["profissional_perfil", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profissional_perfil")
        .select(
          "user_id, bio, cidade, especialidades, chave_pix, pix_key_type, pix_holder_name, pix_holder_document, anos_experiencia, raio_atendimento_km, atende_emergencias, veiculo_proprio, genero, oferece_apoio_feminino, ativo, lat, lng, cpf, cnpj",
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
    formState: { errors },
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
      chave_pix: "",
      pix_key_type: undefined,
      pix_holder_name: "",
      pix_holder_document: "",
      cpf: "",
      cnpj: "",
      anos_experiencia: 0,
      raio_atendimento_km: 15,
      atende_emergencias: false,
      veiculo_proprio: false,
      genero: "nao_informar",
      oferece_apoio_feminino: false,
    },
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      nome: profile.nome ?? "",
      whatsapp: profile.whatsapp ?? "",
      bio: profissionalPerfil?.bio ?? "",
      cidade: profissionalPerfil?.cidade ?? "",
      chave_pix: profissionalPerfil?.chave_pix ?? "",
      pix_key_type: (profissionalPerfil?.pix_key_type as any) ?? undefined,
      pix_holder_name: profissionalPerfil?.pix_holder_name ?? "",
      pix_holder_document: profissionalPerfil?.pix_holder_document ?? "",
      cpf: profissionalPerfil?.cpf ?? "",
      cnpj: profissionalPerfil?.cnpj ?? "",
      anos_experiencia: profissionalPerfil?.anos_experiencia ?? 0,
      raio_atendimento_km: profissionalPerfil?.raio_atendimento_km ?? 15,
      atende_emergencias: !!profissionalPerfil?.atende_emergencias,
      veiculo_proprio: !!profissionalPerfil?.veiculo_proprio,
      genero: (profissionalPerfil?.genero as any) ?? "nao_informar",
      oferece_apoio_feminino: !!profissionalPerfil?.oferece_apoio_feminino,
    });
  }, [profile, profissionalPerfil, reset]);

  const handleSaveProfile = async (values: ProfileValues) => {
    if (!user) return;
    setSaving(true);

    try {
      // Validar CNPJ se preenchido
      if (values.cnpj && !isValidCnpj(values.cnpj)) {
        toast.error("CNPJ inválido — confira os dígitos");
        setSaving(false);
        return;
      }

      // 1. Update profiles table (Basic)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ nome: values.nome, whatsapp: values.whatsapp })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // 2. Geocode city (best-effort)
      let geo: { lat: number; lng: number } | null = null;
      if (values.cidade?.trim()) {
        try {
          const { geocodeCidade } = await import("@/lib/geo");
          geo = await geocodeCidade(values.cidade);
        } catch (e) {
          console.warn("[ProfissionalConfiguracoes] geocoding failed", e);
        }
      }

      // 3. Upsert profissional_perfil (single payload, all fields)
      const profissionalPayload = {
        user_id: user.id,
        bio: values.bio || null,
        cidade: values.cidade || null,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        chave_pix: values.chave_pix || null,
        pix_key: values.chave_pix || null,
        pix_key_type: values.pix_key_type || null,
        pix_holder_name: values.pix_holder_name || null,
        pix_holder_document: values.pix_holder_document || null,
        cpf: values.cpf ? values.cpf.replace(/\D/g, "") : null,
        cnpj: values.cnpj ? values.cnpj.replace(/\D/g, "") : null,
        anos_experiencia: Number(values.anos_experiencia ?? 0),
        raio_atendimento_km: Number(values.raio_atendimento_km ?? 15),
        atende_emergencias: !!values.atende_emergencias,
        veiculo_proprio: !!values.veiculo_proprio,
        genero: values.genero || "nao_informar",
        oferece_apoio_feminino: !!values.oferece_apoio_feminino,
        updated_at: new Date().toISOString(),
      };

      const { error: perfilError } = await supabase
        .from("profissional_perfil")
        .upsert(profissionalPayload as any, { onConflict: "user_id" });

      if (perfilError) {
        console.error("[ProfissionalConfiguracoes] erro ao salvar profissional_perfil", {
          code: perfilError.code,
          message: perfilError.message,
          details: perfilError.details,
          hint: perfilError.hint,
          payload: profissionalPayload,
        });
        throw perfilError;
      }

      // 4. Confirm persistence
      const { data: savedPerfil } = await supabase
        .from("profissional_perfil")
        .select("genero, oferece_apoio_feminino, anos_experiencia, raio_atendimento_km, chave_pix")
        .eq("user_id", user.id)
        .maybeSingle();

      console.info("[ProfissionalConfiguracoes] perfil salvo confirmado", savedPerfil);

      if (savedPerfil && (savedPerfil as any).genero !== profissionalPayload.genero) {
        toast.error("Perfil enviado, mas os dados não foram confirmados no banco.");
      } else {
        toast.success("Perfil salvo com sucesso!");
      }

      await refetchPerfil();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (error: any) {
      console.error("[ProfissionalConfiguracoes] erro ao salvar perfil", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      toast.error("Erro ao salvar perfil", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => updatePhoto(reader.result as string);
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

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_2fr] animate-in fade-in duration-500">
      {/* Sidebar Info */}
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
          <h3 className="text-xl font-bold">{profile?.nome || "Profissional"}</h3>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </section>

        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-sm">
          <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand" /> Segurança
          </h4>
          <Button
            variant="outline"
            className="w-full rounded-xl text-xs font-bold py-6"
            onClick={handleResetPassword}
          >
            Redefinir Senha
          </Button>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            Um link será enviado para o seu e-mail.
          </p>
        </section>
      </div>

      {/* Main Form */}
      <div className="space-y-8">
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-brand" />
              <h3 className="font-bold text-lg">Seu Perfil Profissional</h3>
            </div>
          </div>

          <form
            onSubmit={handleSubmit(handleSaveProfile)}
            className="grid gap-x-8 gap-y-6 sm:grid-cols-2"
          >
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Nome de Exibição
              </label>
              <input
                {...register("nome")}
                className={`w-full text-sm font-medium pb-2 border-b focus:outline-none transition-colors bg-transparent ${errors.nome ? "border-red-500" : "border-brand focus:border-brand"}`}
                placeholder="Como os clientes te chamam"
              />
              {errors.nome && (
                <p className="text-[10px] text-red-500 font-bold">{errors.nome.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                WhatsApp Profissional
              </label>
              <input
                {...register("whatsapp")}
                className={`w-full text-sm font-medium pb-2 border-b focus:outline-none transition-colors bg-transparent ${errors.whatsapp ? "border-red-500" : "border-brand focus:border-brand"}`}
                placeholder="(00) 00000-0000"
              />
              {errors.whatsapp && (
                <p className="text-[10px] text-red-500 font-bold">{errors.whatsapp.message}</p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Bio / Sobre você
              </label>
              <textarea
                {...register("bio")}
                className="w-full text-sm font-medium p-3 rounded-xl border border-border focus:outline-none transition-colors bg-transparent focus:border-brand resize-none"
                placeholder="Ex: Trabalho com elétrica há 10 anos, sou especialista em instalações residenciais..."
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Cidade de Atendimento
              </label>
              <input
                {...register("cidade")}
                className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                placeholder="Ex: São Paulo - SP"
              />
            </div>

            {/* Dados de Identificação */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                CPF (opcional)
              </label>
              <input
                value={watch("cpf") || ""}
                onChange={(e) => setValue("cpf", fmtCpf(e.target.value), { shouldValidate: false })}
                className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                CNPJ do MEI (opcional)
              </label>
              <input
                value={watch("cnpj") || ""}
                onChange={(e) => setValue("cnpj", fmtCnpj(e.target.value), { shouldValidate: false })}
                className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
            </div>

            {/* Dados do Pix */}
            <div className="sm:col-span-2 rounded-2xl border border-brand/10 bg-brand-soft/10 p-5">
              <div className="mb-5">
                <h4 className="text-sm font-bold text-slate-900">Dados Bancários (Pix)</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Para receber os repasses, informe a sua chave Pix e os dados do titular.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Chave Pix
                  </label>
                  <input
                    {...register("chave_pix")}
                    className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                    placeholder="Chave Pix"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Tipo de Chave
                  </label>
                  <select
                    {...register("pix_key_type")}
                    className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                  >
                    <option value="">Selecione...</option>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="PHONE">Telefone</option>
                    <option value="RANDOM">Chave Aleatória</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Nome Completo do Titular
                  </label>
                  <input
                    {...register("pix_holder_name")}
                    className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                    placeholder="Nome como está no banco"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    CPF/CNPJ do Titular
                  </label>
                  <input
                    {...register("pix_holder_document")}
                    className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                    placeholder="Somente números"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Anos de Experiência
              </label>
              <input
                type="number"
                {...register("anos_experiencia")}
                className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                placeholder="Ex: 5"
                min="0"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Raio de Atendimento (KM)
              </label>
              <input
                type="number"
                {...register("raio_atendimento_km")}
                className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                placeholder="Ex: 15"
                min="0"
              />
            </div>

            {/* Compatibilidade de Atendimento */}
            <div className="sm:col-span-2 rounded-2xl border border-brand/10 bg-brand-soft/10 p-5">
              <div className="mb-5">
                <h4 className="text-sm font-bold text-slate-900">Compatibilidade de atendimento</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Essa informação ajuda a mostrar pedidos compatíveis com o tipo de atendimento
                  escolhido pela cliente.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Gênero para atendimento
                  </label>
                  <select
                    {...register("genero")}
                    className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                  >
                    <option value="nao_informar">Prefiro não informar</option>
                    <option value="mulher">Mulher</option>
                    <option value="homem">Homem</option>
                    <option value="outro">Outro</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Usado apenas para compatibilidade operacional dos pedidos.
                  </p>
                </div>

                <label className="flex items-center justify-between gap-4 p-4 bg-white border border-border rounded-xl cursor-pointer">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Apoio feminino disponível</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Marque se você trabalha com uma mulher de apoio para visitas acompanhadas.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    {...register("oferece_apoio_feminino")}
                    className="h-5 w-5 accent-brand cursor-pointer shrink-0"
                  />
                </label>
              </div>
            </div>

            <div className="sm:col-span-2 mt-4 flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="bg-brand text-white rounded-full px-8 font-bold"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {showSuccess ? "Salvo!" : "Salvar Perfil"}
              </Button>
            </div>
          </form>
        </section>

        {/* Especialidades Read-only */}
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <User className="h-5 w-5 text-brand" />
            <h3 className="font-bold text-lg">Especialidades (Serviços)</h3>
          </div>

          {profissionalPerfil?.especialidades && profissionalPerfil.especialidades.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profissionalPerfil.especialidades.map((esp: string) => (
                <span
                  key={esp}
                  className="px-3 py-1.5 bg-brand-soft text-brand-foreground text-xs font-bold rounded-full"
                >
                  {esp}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma especialidade cadastrada.</p>
          )}

          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              As especialidades definem quais pedidos de orçamento você recebe. Para adicionar ou
              remover especialidades,{" "}
              <strong>entre em contato com o suporte ou administrador</strong> da plataforma.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
