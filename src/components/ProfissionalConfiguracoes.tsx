import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, ShieldCheck, MapPin, Briefcase, Camera, Loader2, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const profileSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  bio: z.string().optional(),
  cidade: z.string().optional(),
  chave_pix: z.string().optional(),
  anos_experiencia: z.coerce.number().min(0).optional(),
  raio_atendimento_km: z.coerce.number().min(0).optional(),
  atende_emergencias: z.boolean().optional(),
  veiculo_proprio: z.boolean().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

type ProfissionalPerfilData = {
  bio: string | null;
  cidade: string | null;
  especialidades: string[] | null;
  chave_pix?: string | null;
  anos_experiencia?: number | null;
  raio_atendimento_km?: number | null;
  atende_emergencias?: boolean | null;
  veiculo_proprio?: boolean | null;
};

export function ProfissionalConfiguracoes() {
  const { user, profile, profilePhoto, updatePhoto } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: profissionalPerfil } = useQuery({
    queryKey: ["profissional_perfil", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profissional_perfil")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data as unknown as ProfissionalPerfilData | null;
    },
    enabled: !!user,
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome: profile?.nome ?? "",
      whatsapp: profile?.whatsapp ?? "",
      bio: "",
      cidade: "",
      chave_pix: "",
      anos_experiencia: 0,
      raio_atendimento_km: 0,
      atende_emergencias: false,
      veiculo_proprio: false,
    }
  });

  useEffect(() => {
    if (profile && profissionalPerfil) {
      reset({
        nome: profile.nome ?? "",
        whatsapp: profile.whatsapp ?? "",
        bio: profissionalPerfil.bio ?? "",
        cidade: profissionalPerfil.cidade ?? "",
        chave_pix: profissionalPerfil.chave_pix ?? "",
        anos_experiencia: profissionalPerfil.anos_experiencia ?? 0,
        raio_atendimento_km: profissionalPerfil.raio_atendimento_km ?? 0,
        atende_emergencias: profissionalPerfil.atende_emergencias ?? false,
        veiculo_proprio: profissionalPerfil.veiculo_proprio ?? false,
      });
    }
  }, [profile, profissionalPerfil, reset]);

  const handleSaveProfile = async (values: ProfileValues) => {
    if (!user) return;
    setSaving(true);
    
    // Update profiles table
    const p1 = supabase.from("profiles").update({ nome: values.nome, whatsapp: values.whatsapp }).eq("id", user.id);
    
    // Update profissional_perfil table
    const p2 = supabase.from("profissional_perfil").update({ 
      bio: values.bio, 
      cidade: values.cidade,
      chave_pix: values.chave_pix,
      anos_experiencia: values.anos_experiencia,
      raio_atendimento_km: values.raio_atendimento_km,
      atende_emergencias: values.atende_emergencias,
      veiculo_proprio: values.veiculo_proprio
    } as any).eq("user_id", user.id);
    
    const [res1, res2] = await Promise.all([p1, p2]);
    
    setSaving(false);
    
    if (res1.error || res2.error) {
      toast.error("Erro ao salvar", { description: res1.error?.message || res2.error?.message });
      return;
    }
    
    toast.success("Perfil atualizado com sucesso!");
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
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
          <div className="relative mx-auto w-24 h-24 mb-6 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={handleFileChange} />
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-brand/20" />
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
          <Button variant="outline" className="w-full rounded-xl text-xs font-bold py-6" onClick={handleResetPassword}>
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

          <form onSubmit={handleSubmit(handleSaveProfile)} className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome de Exibição</label>
              <input
                {...register("nome")}
                className={`w-full text-sm font-medium pb-2 border-b focus:outline-none transition-colors bg-transparent ${errors.nome ? "border-red-500" : "border-brand focus:border-brand"}`}
                placeholder="Como os clientes te chamam"
              />
              {errors.nome && <p className="text-[10px] text-red-500 font-bold">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp Profissional</label>
              <input
                {...register("whatsapp")}
                className={`w-full text-sm font-medium pb-2 border-b focus:outline-none transition-colors bg-transparent ${errors.whatsapp ? "border-red-500" : "border-brand focus:border-brand"}`}
                placeholder="(00) 00000-0000"
              />
              {errors.whatsapp && <p className="text-[10px] text-red-500 font-bold">{errors.whatsapp.message}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Bio / Sobre você</label>
              <textarea
                {...register("bio")}
                className="w-full text-sm font-medium p-3 rounded-xl border border-border focus:outline-none transition-colors bg-transparent focus:border-brand resize-none"
                placeholder="Ex: Trabalho com elétrica há 10 anos, sou especialista em instalações residenciais..."
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cidade de Atendimento</label>
              <input
                {...register("cidade")}
                className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                placeholder="Ex: São Paulo - SP"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chave PIX (Para Repasses)</label>
              <input
                {...register("chave_pix")}
                className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                placeholder="CPF, CNPJ, E-mail ou Celular"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Anos de Experiência</label>
              <input
                type="number"
                {...register("anos_experiencia")}
                className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                placeholder="Ex: 5"
                min="0"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Raio de Atendimento (KM)</label>
              <input
                type="number"
                {...register("raio_atendimento_km")}
                className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none transition-colors bg-transparent focus:border-brand"
                placeholder="Ex: 15"
                min="0"
              />
            </div>

            {/* Configurações Operacionais Avançadas */}
            <div className="sm:col-span-2 grid gap-6 sm:grid-cols-2 mt-2 pt-6 border-t border-border/50">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-border rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-800">Atendimento 24h / Urgência</p>
                  <p className="text-xs text-muted-foreground">Aceita chamados de madrugada e finais de semana.</p>
                </div>
                <input type="checkbox" {...register("atende_emergencias")} className="h-5 w-5 accent-brand cursor-pointer" />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-border rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-800">Veículo Próprio</p>
                  <p className="text-xs text-muted-foreground">Utilizado para carregar materiais volumosos.</p>
                </div>
                <input type="checkbox" {...register("veiculo_proprio")} className="h-5 w-5 accent-brand cursor-pointer" />
              </div>
            </div>

            <div className="sm:col-span-2 mt-4 flex justify-end">
              <Button type="submit" disabled={saving} className="bg-brand text-white rounded-full px-8 font-bold">
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
                <span key={esp} className="px-3 py-1.5 bg-brand-soft text-brand-foreground text-xs font-bold rounded-full">
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
              As especialidades definem quais pedidos de orçamento você recebe. Para adicionar ou remover especialidades, <strong>entre em contato com o suporte ou administrador</strong> da plataforma.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
