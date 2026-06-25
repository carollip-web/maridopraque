import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  User,
  MapPin,
  FileText,
  Camera,
  Briefcase,
  Send,
} from "lucide-react";

export const Route = createFileRoute("/profissional-cadastro")({
  validateSearch: (search: Record<string, unknown>): { apoio?: boolean } => ({
    apoio:
      search.apoio === "1" || search.apoio === "true" || search.apoio === true
        ? true
        : undefined,
  }),
  component: ProfissionalCadastro,
});

const STEPS = [
  { id: 1, label: "Dados pessoais", icon: User },
  { id: 2, label: "Endereço", icon: MapPin },
  { id: 3, label: "Experiência", icon: Briefcase },
  { id: 4, label: "Documentos", icon: FileText },
  { id: 5, label: "Revisão", icon: Send },
];

const ESPECIALIDADES_OPCOES = [
  "chaveiro",
  "elétrica",
  "engenharia",
  "hidráulica",
  "instalação",
  "montagem",
  "reparos",
];

const ESPECIALIDADES_LABEL: Record<string, string> = {
  chaveiro: "Chaveiro",
  "elétrica": "Elétrica",
  engenharia: "Engenharia",
  "hidráulica": "Hidráulica",
  "instalação": "Instalação",
  montagem: "Montagem de Móveis",
  reparos: "Reparos Gerais",
};

const COMO_CONHECEU = [
  "Instagram",
  "Google",
  "Indicação de amigo",
  "Facebook",
  "LinkedIn",
  "Panfleto",
  "Outro",
];

type FormData = {
  nome: string;
  email: string;
  cpf: string;
  cnpj: string;
  data_nascimento: string;
  telefone: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  bio: string;
  especialidades: string[];
  experiencia_anos: string;
  atende_emergencias: boolean;
  veiculo_proprio: boolean;
  como_conheceu: string;
  observacoes_cadastro: string;
  foto_documento_frente: File | null;
  foto_documento_verso: File | null;
  foto_selfie: File | null;
  genero: string;
  oferece_apoio_feminino: boolean;
};

function emptyForm(): FormData {
  return {
    nome: "",
    email: "",
    cpf: "",
    cnpj: "",
    data_nascimento: "",
    telefone: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    bio: "",
    especialidades: [],
    experiencia_anos: "",
    atende_emergencias: false,
    veiculo_proprio: false,
    como_conheceu: "",
    observacoes_cadastro: "",
    foto_documento_frente: null,
    foto_documento_verso: null,
    foto_selfie: null,
    genero: "nao_informar",
    oferece_apoio_feminino: false,
  };
}

function fmtCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function fmtCnpj(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
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
  const d2 = calc(c.slice(0, 12) + String(d1), p2);
  return d1 === parseInt(c[12], 10) && d2 === parseInt(c[13], 10);
}

function isValidCpf(v: string) {
  const c = v.replace(/\D/g, "");
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  const calc = (base: string, fator: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * (fator - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(c.slice(0, 9), 10);
  const d2 = calc(c.slice(0, 10), 11);
  return d1 === parseInt(c[9], 10) && d2 === parseInt(c[10], 10);
}

function isAdult(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 18 && age <= 100;
}

function fmtPhone(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{4})$/, "$1-$2");
}

function fmtCep(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function FileUploadBox({
  label,
  accept,
  value,
  onChange,
}: {
  label: string;
  accept: string;
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase text-muted-foreground">{label}</label>
      <label className="mt-1.5 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-6 cursor-pointer hover:border-brand/50 hover:bg-brand/5 transition-all">
        {value ? (
          <div className="text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-1" />
            <p className="text-sm font-semibold text-green-700 truncate max-w-[200px]">
              {value.name}
            </p>
            <p className="text-xs text-muted-foreground">{(value.size / 1024).toFixed(0)} KB</p>
          </div>
        ) : (
          <div className="text-center">
            <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">Clique para enviar</p>
            <p className="text-xs text-muted-foreground">JPG, PNG ou PDF · máx. 10MB</p>
          </div>
        )}
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}

function ProfissionalCadastro() {
  const { user, loading, isProfissional } = useAuth();
  const navigate = useNavigate();
  const { apoio } = Route.useSearch();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(() => ({
    ...emptyForm(),
    oferece_apoio_feminino: apoio === true,
  }));
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [existingDocFrente, setExistingDocFrente] = useState<string | null>(null);
  const [existingDocVerso, setExistingDocVerso] = useState<string | null>(null);
  const [existingSelfie, setExistingSelfie] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState(false);

  const set = (k: keyof FormData, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        // Fetch ALL fields from profissional_perfil
        const { data: perfil } = await supabase
          .from("profissional_perfil")
          .select(
            "aprovacao_status, cadastro_completo, especialidades, cidade, bio, genero, cpf, cnpj, data_nascimento, telefone, cep, bairro, endereco, numero, complemento, estado, anos_experiencia, experiencia_anos, atende_emergencias, veiculo_proprio, como_conheceu, observacoes_cadastro, oferece_apoio_feminino, foto_documento_frente, foto_documento_verso, foto_selfie"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        // Fetch from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome, email, whatsapp")
          .eq("id", user.id)
          .maybeSingle();

        if (perfil) {
          const status = perfil.aprovacao_status ?? "pendente";
          setExistingStatus(status);

          // Marca retomada do cadastro (uma vez por sessão por usuário)
          // quando o perfil já existe e ainda não foi aprovado.
          if (status !== "aprovado") {
            const flagKey = `mpq:retomada:${user.id}`;
            if (typeof window !== "undefined" && !sessionStorage.getItem(flagKey)) {
              sessionStorage.setItem(flagKey, "1");
              void supabase
                .from("profissional_perfil")
                .update({ cadastro_retomado_em: new Date().toISOString() })
                .eq("user_id", user.id);
            }
          }


          // If cadastro_completo and not yet approved, go straight to submitted screen
          if (perfil.cadastro_completo && status !== "aprovado") {
            setSubmitted(true);
            setLoadingProfile(false);
            return;
          }

          // Track already-uploaded docs
          if (perfil.foto_documento_frente) setExistingDocFrente(perfil.foto_documento_frente as string);
          if (perfil.foto_documento_verso) setExistingDocVerso(perfil.foto_documento_verso as string);
          if (perfil.foto_selfie) setExistingSelfie(perfil.foto_selfie as string);


          // Pre-fill ALL form fields from profissional_perfil
          setForm((f) => ({
            ...f,
            especialidades: (perfil.especialidades as string[]) || [],
            cidade: (perfil.cidade as string) || "",
            bio: (perfil.bio as string) || "",
            genero: (perfil.genero as string) || "nao_informar",
            cpf: perfil.cpf ? fmtCpf(perfil.cpf as string) : "",
            cnpj: perfil.cnpj ? fmtCnpj(perfil.cnpj as string) : "",
            data_nascimento: (perfil.data_nascimento as string) || "",
            telefone: perfil.telefone ? fmtPhone(perfil.telefone as string) : (profile?.whatsapp ? fmtPhone(profile.whatsapp) : ""),
            cep: perfil.cep ? fmtCep(perfil.cep as string) : "",
            bairro: (perfil.bairro as string) || "",
            endereco: (perfil.endereco as string) || "",
            numero: (perfil.numero as string) || "",
            complemento: (perfil.complemento as string) || "",
            estado: (perfil.estado as string) || "",
            experiencia_anos: perfil.experiencia_anos != null ? String(perfil.experiencia_anos) : (perfil.anos_experiencia != null ? String(perfil.anos_experiencia) : ""),
            atende_emergencias: (perfil.atende_emergencias as boolean) ?? false,
            veiculo_proprio: (perfil.veiculo_proprio as boolean) ?? false,
            como_conheceu: (perfil.como_conheceu as string) || "",
            observacoes_cadastro: (perfil.observacoes_cadastro as string) || "",
            oferece_apoio_feminino: (perfil.oferece_apoio_feminino as boolean) ?? (apoio === true),
            nome: (profile?.nome as string) || "",
            email: (profile?.email as string) || "",
          }));

          // Compute first incomplete step to resume from
          const hasStep1 = !!((profile?.nome || perfil.cpf) && (perfil.telefone || profile?.whatsapp));
          const hasStep2 = !!(perfil.cep && perfil.endereco && perfil.cidade);
          const hasStep3 = !!((perfil.especialidades as string[] | null)?.length && perfil.bio);
          const hasStep4 = !!(perfil.foto_documento_frente && perfil.foto_documento_verso && perfil.foto_selfie);

          if (hasStep1 && hasStep2 && hasStep3 && hasStep4) {
            setStep(5);
          } else if (hasStep1 && hasStep2 && hasStep3) {
            setStep(4);
          } else if (hasStep1 && hasStep2) {
            setStep(3);
          } else if (hasStep1) {
            setStep(2);
          }
          // else stay on step 1
        } else {
          // No perfil yet — just fill from profiles
          if (profile) {
            setForm((f) => ({
              ...f,
              nome: profile.nome || "",
              email: profile.email || "",
              telefone: profile.whatsapp ? fmtPhone(profile.whatsapp) : "",
            }));
          }
        }
      } catch (e: any) {
        console.error("Error loading profile:", e);
      } finally {
        setLoadingProfile(false);
      }
    };
    loadProfile();
  }, [user]);

  const buscarCep = async (cep: string) => {
    const raw = cep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          endereco: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          estado: data.uf || "",
        }));
      }
    } catch {
      /* ignore */
    } finally {
      setFetchingCep(false);
    }
  };

  const uploadFile = async (file: File, folder: string) => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${folder}.${ext}`;
    const { error } = await supabase.storage
      .from("documentos-profissionais")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("documentos-profissionais").getPublicUrl(path);
    return data.publicUrl;
  };

  // Save partial progress after each step
  const saveStepProgress = async (currentStep: number) => {
    if (!user) return;
    setSavingStep(true);
    try {
      if (currentStep === 1) {
        // Save personal data to profiles + profissional_perfil
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ nome: form.nome, email: form.email, whatsapp: form.telefone })
          .eq("id", user.id);
        if (profileErr) throw profileErr;

        const { error: perfilErr } = await supabase
          .from("profissional_perfil")
          .upsert({
            user_id: user.id,
            genero: form.genero || "nao_informar",
            cpf: form.cpf.replace(/\D/g, "") || null,
            cnpj: form.cnpj ? form.cnpj.replace(/\D/g, "") : null,
            data_nascimento: form.data_nascimento || null,
            telefone: form.telefone,
          });
        if (perfilErr) throw perfilErr;
      } else if (currentStep === 2) {
        // Save address data
        const { error } = await supabase
          .from("profissional_perfil")
          .upsert({
            user_id: user.id,
            cidade: form.cidade,
            cep: form.cep.replace(/\D/g, ""),
            bairro: form.bairro,
            endereco: form.endereco,
            numero: form.numero,
            complemento: form.complemento || null,
            estado: form.estado,
          });
        if (error) throw error;
      } else if (currentStep === 3) {
        // Save specialties and bio
        const { error } = await supabase
          .from("profissional_perfil")
          .upsert({
            user_id: user.id,
            especialidades: form.especialidades,
            bio: form.bio,
            anos_experiencia: form.experiencia_anos ? Number(form.experiencia_anos) : null,
            atende_emergencias: form.atende_emergencias ?? false,
            veiculo_proprio: form.veiculo_proprio ?? false,
            como_conheceu: form.como_conheceu || null,
            observacoes_cadastro: form.observacoes_cadastro || null,
          });
        if (error) throw error;
      } else if (currentStep === 4) {
        // Upload documents and save URLs immediately
        let urlFrente = existingDocFrente;
        let urlVerso = existingDocVerso;
        let urlSelfie = existingSelfie;

        if (form.foto_documento_frente) {
          try {
            urlFrente = await uploadFile(form.foto_documento_frente, "doc_frente");
          } catch (e: any) {
            toast.error("Erro ao enviar documento (frente)", { description: e?.message });
            throw e;
          }
        }
        if (form.foto_documento_verso) {
          try {
            urlVerso = await uploadFile(form.foto_documento_verso, "doc_verso");
          } catch (e: any) {
            toast.error("Erro ao enviar documento (verso)", { description: e?.message });
            throw e;
          }
        }
        if (form.foto_selfie) {
          try {
            urlSelfie = await uploadFile(form.foto_selfie, "selfie");
          } catch (e: any) {
            toast.error("Erro ao enviar selfie", { description: e?.message });
            throw e;
          }
        }

        const { error } = await supabase
          .from("profissional_perfil")
          .upsert({
            user_id: user.id,
            ...(urlFrente && { foto_documento_frente: urlFrente }),
            ...(urlVerso && { foto_documento_verso: urlVerso }),
            ...(urlSelfie && { foto_selfie: urlSelfie }),
          });
        if (error) throw error;

        // Update local state so review step shows them as uploaded
        if (urlFrente) setExistingDocFrente(urlFrente);
        if (urlVerso) setExistingDocVerso(urlVerso);
        if (urlSelfie) setExistingSelfie(urlSelfie);
      }
    } catch (e: any) {
      toast.error("Erro ao salvar progresso", { description: e?.message });
      throw e; // Re-throw to prevent advancing step
    } finally {
      setSavingStep(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    // Final guard — bloqueia envio com qualquer campo obrigatório faltando
    const missing: string[] = [];
    if (!form.nome.trim() || form.nome.trim().split(/\s+/).length < 2) missing.push("nome completo");
    if (!isValidCpf(form.cpf)) missing.push("CPF válido");
    if (!form.data_nascimento || !isAdult(form.data_nascimento)) missing.push("data de nascimento");
    if (form.telefone.replace(/\D/g, "").length < 10) missing.push("telefone");
    if (form.cep.replace(/\D/g, "").length !== 8) missing.push("CEP");
    if (!form.endereco.trim() || !form.numero.trim() || !form.bairro.trim() || !form.cidade.trim() || !form.estado.trim()) missing.push("endereço completo");
    if (form.especialidades.length === 0) missing.push("especialidades");
    if (form.bio.trim().length < 30) missing.push("mini bio (mín. 30 caracteres)");
    if (form.experiencia_anos === "" || form.experiencia_anos === null) missing.push("anos de experiência");
    if ((!form.foto_documento_frente && !existingDocFrente) ||
        (!form.foto_documento_verso && !existingDocVerso) ||
        (!form.foto_selfie && !existingSelfie)) missing.push("documentos (frente, verso e selfie)");
    if (missing.length > 0) {
      toast.error("Cadastro incompleto", { description: `Faltam: ${missing.join(", ")}` });
      return;
    }
    setSaving(true);
    try {
      // Documents should already be uploaded by step 4 save.
      // Only upload if new files were selected and not yet persisted.
      let urlFrente = existingDocFrente;
      let urlVerso = existingDocVerso;
      let urlSelfie = existingSelfie;

      if (form.foto_documento_frente) {
        try {
          urlFrente = await uploadFile(form.foto_documento_frente, "doc_frente");
        } catch (e: any) {
          toast.error("Erro ao enviar documento (frente)", { description: e?.message });
          throw e;
        }
      }
      if (form.foto_documento_verso) {
        try {
          urlVerso = await uploadFile(form.foto_documento_verso, "doc_verso");
        } catch (e: any) {
          toast.error("Erro ao enviar documento (verso)", { description: e?.message });
          throw e;
        }
      }
      if (form.foto_selfie) {
        try {
          urlSelfie = await uploadFile(form.foto_selfie, "selfie");
        } catch (e: any) {
          toast.error("Erro ao enviar selfie", { description: e?.message });
          throw e;
        }
      }

      const payload = {
        user_id: user.id,
        bio: form.bio,
        especialidades: form.especialidades,
        cidade: form.cidade,
        cpf: form.cpf.replace(/\D/g, ""),
        cnpj: form.cnpj ? form.cnpj.replace(/\D/g, "") : null,
        data_nascimento: form.data_nascimento || null,
        telefone: form.telefone,
        cep: form.cep.replace(/\D/g, ""),
        endereco: form.endereco,
        numero: form.numero,
        complemento: form.complemento || null,
        bairro: form.bairro,
        estado: form.estado,
        anos_experiencia: form.experiencia_anos ? Number(form.experiencia_anos) : null,
        atende_emergencias: form.atende_emergencias ?? false,
        veiculo_proprio: form.veiculo_proprio ?? false,
        como_conheceu: form.como_conheceu || null,
        observacoes_cadastro: form.observacoes_cadastro || null,
        ...(urlFrente && { foto_documento_frente: urlFrente }),
        ...(urlVerso && { foto_documento_verso: urlVerso }),
        ...(urlSelfie && { foto_selfie: urlSelfie }),
        aprovacao_status: "pendente",
        cadastro_completo: true,
        cadastro_submetido_em: new Date().toISOString(),
        ativo: false,
        genero: form.genero || "nao_informar",
        oferece_apoio_feminino: false,
        aguardando_reenvio_admin: false,
        bloqueado_em: null,
        bloqueado_por: null,
      };

      const { error } = await supabase.from("profissional_perfil").upsert(payload);
      if (error) throw error;

      // update profile name
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ nome: form.nome, whatsapp: form.telefone })
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      // Registra reenvio no histórico (para o admin ver)
      await supabase.from("profissional_perfil_alteracoes").insert({
        profissional_user_id: user.id,
        campo: "__reenvio__",
        valor_antigo: null,
        valor_novo: "Profissional reenviou o cadastro para validação",
        alterado_por: user.id,
        alterado_por_role: "profissional",
        origem: "profissional",
      });

      // Notifica admins
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (admins && admins.length > 0) {
        await supabase.from("notificacoes").insert(
          admins.map((a: any) => ({
            user_id: a.user_id,
            titulo: "Profissional reenviou o cadastro",
            mensagem: `${form.nome} revisou e reenviou o cadastro para validação.`,
            link: "/admin-validacao",
            lida: false,
          })),
        );
      }

      toast.success("Cadastro enviado para análise!");
      setSubmitted(true);
    } catch (e: any) {
      toast.error("Erro ao enviar cadastro", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingProfile)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );

  if (submitted) {
    const statusLabel: Record<string, { label: string; color: string; desc: string }> = {
      em_analise: {
        label: "Em análise",
        color: "text-amber-600 bg-amber-50",
        desc: "Estamos revisando seus documentos e foto. O prazo é de até 2 dias úteis. Você receberá uma notificação no painel quando for aprovado.",
      },
      aprovado: {
        label: "Aprovado ✓",
        color: "text-green-600 bg-green-50",
        desc: "Parabéns! Seu cadastro foi aprovado. Acesse o painel profissional.",
      },
      rejeitado: {
        label: "Requer revisão",
        color: "text-red-600 bg-red-50",
        desc: "Seu cadastro precisa de ajustes. Verifique os documentos e reenvie.",
      },
      pendente: {
        label: "Cadastro recebido",
        color: "text-slate-600 bg-slate-100",
        desc: "Seu cadastro foi recebido e está na fila de análise. O prazo é de até 2 dias úteis.",
      },
    };
    const st = statusLabel[existingStatus ?? "em_analise"];
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-border p-8 text-center shadow-lg">
          <div className="h-16 w-16 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-5">
            <Send className="h-7 w-7 text-brand" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Cadastro enviado!</h1>
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-bold ${st.color} mb-3`}>
            {st.label}
          </span>
          <p className="text-muted-foreground text-sm mb-6">{st.desc}</p>
          {existingStatus === "aprovado" ? (
            <Button
              className="w-full bg-brand text-white rounded-full"
              onClick={() => navigate({ to: "/profissional" })}
            >
              Ir para o painel
            </Button>
          ) : existingStatus === "rejeitado" ? (
            <Button
              className="w-full rounded-full"
              variant="outline"
              onClick={() => setSubmitted(false)}
            >
              Revisar cadastro
            </Button>
          ) : (
            <Button
              className="w-full rounded-full"
              variant="outline"
              onClick={() => navigate({ to: "/" })}
            >
              Voltar ao início
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Cadastro de Prestador</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Preencha seus dados para fazer parte da nossa equipe.
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${done ? "bg-brand text-white" : active ? "bg-brand text-white ring-4 ring-brand/20" : "bg-slate-200 text-slate-500"}`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <p
                    className={`text-[10px] mt-1 font-semibold hidden sm:block ${active ? "text-brand" : "text-muted-foreground"}`}
                  >
                    {s.label}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${done ? "bg-brand" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-5">
          {/* Step 1: Personal */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <User className="h-5 w-5 text-brand" /> Dados pessoais
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Nome completo *
                  </label>
                  <input
                    value={form.nome}
                    onChange={(e) => set("nome", e.target.value)}
                    className="input-field mt-1.5"
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">CPF *</label>
                  <input
                    value={form.cpf}
                    onChange={(e) => set("cpf", fmtCpf(e.target.value))}
                    className="input-field mt-1.5"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    CNPJ (opcional)
                  </label>
                  <input
                    value={form.cnpj}
                    onChange={(e) => set("cnpj", fmtCnpj(e.target.value))}
                    className="input-field mt-1.5"
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Data de nascimento *
                  </label>
                  <input
                    type="date"
                    value={form.data_nascimento}
                    onChange={(e) => set("data_nascimento", e.target.value)}
                    className="input-field mt-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    value={form.telefone}
                    onChange={(e) => set("telefone", fmtPhone(e.target.value))}
                    className="input-field mt-1.5"
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    E-mail
                  </label>
                  <input
                    value={form.email}
                    readOnly
                    className="input-field mt-1.5 bg-slate-100 cursor-not-allowed"
                  />
                </div>
                <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground">
                      Gênero para atendimento
                    </label>
                    <select
                      value={form.genero}
                      onChange={(e) => set("genero", e.target.value)}
                      className="input-field mt-1.5"
                    >
                      <option value="nao_informar">Prefiro não informar</option>
                      <option value="mulher">Mulher</option>
                      <option value="homem">Homem</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 2: Address */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand" /> Endereço
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">CEP *</label>
                  <div className="flex gap-2 mt-1.5">
                    <input
                      value={form.cep}
                      onChange={(e) => {
                        const v = fmtCep(e.target.value);
                        set("cep", v);
                        if (v.replace(/\D/g, "").length === 8) buscarCep(v);
                      }}
                      className="input-field flex-1"
                      placeholder="00000-000"
                    />
                    {fetchingCep && (
                      <Loader2 className="h-4 w-4 animate-spin self-center text-brand" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Estado
                  </label>
                  <input
                    value={form.estado}
                    onChange={(e) => set("estado", e.target.value)}
                    className="input-field mt-1.5"
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Logradouro *
                  </label>
                  <input
                    value={form.endereco}
                    onChange={(e) => set("endereco", e.target.value)}
                    className="input-field mt-1.5"
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Número *
                  </label>
                  <input
                    value={form.numero}
                    onChange={(e) => set("numero", e.target.value)}
                    className="input-field mt-1.5"
                    placeholder="123"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Complemento
                  </label>
                  <input
                    value={form.complemento}
                    onChange={(e) => set("complemento", e.target.value)}
                    className="input-field mt-1.5"
                    placeholder="Apto, bloco..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Bairro *
                  </label>
                  <input
                    value={form.bairro}
                    onChange={(e) => set("bairro", e.target.value)}
                    className="input-field mt-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Cidade *
                  </label>
                  <input
                    value={form.cidade}
                    onChange={(e) => set("cidade", e.target.value)}
                    className="input-field mt-1.5"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Experience */}
          {step === 3 && (
            <>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-brand" /> Experiência e especialidades
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Especialidades * (selecione todas que se aplicam)
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ESPECIALIDADES_OPCOES.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() =>
                          set(
                            "especialidades",
                            form.especialidades.includes(e)
                              ? form.especialidades.filter((x) => x !== e)
                              : [...form.especialidades, e],
                          )
                        }
                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${form.especialidades.includes(e) ? "bg-brand text-white border-brand" : "border-border bg-slate-50 hover:border-brand/40"}`}
                      >
                        {ESPECIALIDADES_LABEL[e] ?? e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Anos de experiência *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={form.experiencia_anos}
                    onChange={(e) => set("experiencia_anos", e.target.value)}
                    className="input-field mt-1.5 w-32"
                    placeholder="Ex: 5"
                  />
                </div>
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-brand transition">
                      <input
                        type="checkbox"
                        checked={form.atende_emergencias}
                        onChange={(e) => set("atende_emergencias", e.target.checked)}
                        className="h-5 w-5 accent-brand rounded"
                      />
                      <div>
                        <p className="font-medium text-sm text-slate-800">Atende emergências</p>
                        <p className="text-xs text-slate-500">Aparece com prioridade em pedidos urgentes.</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-brand transition">
                      <input
                        type="checkbox"
                        checked={form.veiculo_proprio}
                        onChange={(e) => set("veiculo_proprio", e.target.checked)}
                        className="h-5 w-5 accent-brand rounded"
                      />
                      <div>
                        <p className="font-medium text-sm text-slate-800">Veículo próprio</p>
                        <p className="text-xs text-slate-500">Indica que você pode levar materiais e ferramentas.</p>
                      </div>
                    </label>
                  </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Mini bio / apresentação *
                  </label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="Conte um pouco sobre você, sua experiência e diferenciais..."
                    className="w-full mt-1.5 px-4 py-3 rounded-xl border border-border bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <p className="text-[11px] text-muted-foreground text-right mt-1">
                    {form.bio.length}/1000
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Como nos conheceu?
                  </label>
                  <select
                    value={form.como_conheceu}
                    onChange={(e) => set("como_conheceu", e.target.value)}
                    className="input-field mt-1.5"
                  >
                    <option value="">Selecione...</option>
                    {COMO_CONHECEU.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Informações adicionais
                  </label>
                  <textarea
                    value={form.observacoes_cadastro}
                    onChange={(e) => set("observacoes_cadastro", e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Certificações, cursos, equipamentos próprios..."
                    className="w-full mt-1.5 px-4 py-3 rounded-xl border border-border bg-slate-50 text-sm resize-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 4: Documents */}
          {step === 4 && (
            <>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand" /> Documentos
              </h2>
              <p className="text-sm text-muted-foreground">
                Envie fotos do seu documento de identidade (RG ou CNH) e uma selfie segurando o
                documento.
              </p>
              <div className="space-y-4">
                {existingDocFrente ? (
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground">Documento — Frente</label>
                    <div className="mt-1.5 flex items-center gap-3 p-4 border-2 border-green-200 bg-green-50 rounded-2xl">
                      <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-700">Documento já enviado ✓</p>
                        <p className="text-xs text-green-600">Arquivo recebido anteriormente</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <FileUploadBox
                    label="Documento — Frente *"
                    accept="image/*,application/pdf"
                    value={form.foto_documento_frente}
                    onChange={(f) => set("foto_documento_frente", f)}
                  />
                )}
                {existingDocVerso ? (
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground">Documento — Verso</label>
                    <div className="mt-1.5 flex items-center gap-3 p-4 border-2 border-green-200 bg-green-50 rounded-2xl">
                      <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-700">Documento já enviado ✓</p>
                        <p className="text-xs text-green-600">Arquivo recebido anteriormente</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <FileUploadBox
                    label="Documento — Verso *"
                    accept="image/*,application/pdf"
                    value={form.foto_documento_verso}
                    onChange={(f) => set("foto_documento_verso", f)}
                  />
                )}
                {existingSelfie ? (
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground">Selfie segurando o documento</label>
                    <div className="mt-1.5 flex items-center gap-3 p-4 border-2 border-green-200 bg-green-50 rounded-2xl">
                      <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-700">Selfie já enviada ✓</p>
                        <p className="text-xs text-green-600">Arquivo recebido anteriormente</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <FileUploadBox
                    label="Selfie segurando o documento *"
                    accept="image/*"
                    value={form.foto_selfie}
                    onChange={(f) => set("foto_selfie", f)}
                  />
                )}
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-muted-foreground">
                🔒 Seus documentos são armazenados com segurança e utilizados apenas para
                verificação de identidade. Não compartilhamos com terceiros.
              </div>
            </>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Send className="h-5 w-5 text-brand" /> Revisão final
              </h2>
              <div className="space-y-3 text-sm">
                {[
                  { label: "Nome", value: form.nome },
                  { label: "CPF", value: form.cpf },
                  { label: "CNPJ", value: form.cnpj },
                  { label: "Telefone", value: form.telefone },
                  {
                    label: "Endereço",
                    value: [form.endereco, form.numero, form.bairro, form.cidade, form.estado]
                      .filter(Boolean)
                      .join(", "),
                  },
                  { label: "Especialidades", value: form.especialidades.join(", ") || "—" },
                  {
                    label: "Experiência",
                    value: form.experiencia_anos ? `${form.experiencia_anos} anos` : "—",
                  },
                  {
                    label: "Doc. frente",
                    value: existingDocFrente ? "Já enviado ✓" : (form.foto_documento_frente?.name ?? "Não enviado"),
                  },
                  { label: "Doc. verso", value: existingDocVerso ? "Já enviado ✓" : (form.foto_documento_verso?.name ?? "Não enviado") },
                  { label: "Selfie", value: existingSelfie ? "Já enviada ✓" : (form.foto_selfie?.name ?? "Não enviado") },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex gap-3 py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-bold text-muted-foreground w-32 shrink-0">{label}</span>
                    <span className="flex-1 truncate">{value || "—"}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                Ao enviar, seu cadastro será analisado pela nossa equipe. Você receberá uma
                notificação com o resultado em até 2 dias úteis.
              </div>
            </>
          )}

          {/* Nav buttons */}
          <div className="flex justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              className="rounded-full gap-2"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            {step < 5 ? (
              <Button
                className="rounded-full bg-brand text-white gap-2"
                disabled={savingStep}
                onClick={async () => {
                  if (step === 1) {
                    if (!form.nome.trim() || form.nome.trim().split(/\s+/).length < 2) {
                      toast.error("Informe seu nome completo (nome e sobrenome)");
                      return;
                    }
                    if (!isValidCpf(form.cpf)) {
                      toast.error("CPF inválido — confira os dígitos");
                      return;
                    }
                    if (!form.data_nascimento || !isAdult(form.data_nascimento)) {
                      toast.error("Informe uma data de nascimento válida (maior de 18 anos)");
                      return;
                    }
                    if (form.telefone.replace(/\D/g, "").length < 10) {
                      toast.error("Telefone/WhatsApp inválido");
                      return;
                    }
                    if (form.cnpj && !isValidCnpj(form.cnpj)) {
                      toast.error("CNPJ inválido — confira os dígitos");
                      return;
                    }
                  }
                  if (step === 2) {
                    if (form.cep.replace(/\D/g, "").length !== 8) {
                      toast.error("CEP inválido");
                      return;
                    }
                    if (!form.endereco.trim() || !form.numero.trim() || !form.bairro.trim() || !form.cidade.trim() || !form.estado.trim()) {
                      toast.error("Preencha todos os campos de endereço (logradouro, número, bairro, cidade e estado)");
                      return;
                    }
                  }
                  if (step === 3) {
                    if (form.especialidades.length === 0) {
                      toast.error("Selecione pelo menos uma especialidade");
                      return;
                    }
                    if (form.bio.trim().length < 30) {
                      toast.error("A mini bio precisa ter pelo menos 30 caracteres");
                      return;
                    }
                    if (form.experiencia_anos === "" || form.experiencia_anos === null || Number(form.experiencia_anos) < 0) {
                      toast.error("Informe seus anos de experiência");
                      return;
                    }
                  }
                  if (
                    step === 4 &&
                    ((!form.foto_documento_frente && !existingDocFrente) ||
                     (!form.foto_documento_verso && !existingDocVerso) ||
                     (!form.foto_selfie && !existingSelfie))
                  ) {
                    toast.error("Envie todos os documentos obrigatórios (frente, verso e selfie)");
                    return;
                  }
                  // Save progress before advancing
                  try {
                    await saveStepProgress(step);
                    setStep((s) => s + 1);
                  } catch {
                    // Error toast already shown inside saveStepProgress
                  }
                }}
              >
                {savingStep ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  <>Próximo <ChevronRight className="h-4 w-4" /></>
                )}
              </Button>
            ) : (
              <Button
                className="rounded-full bg-brand text-white gap-2 font-bold px-8"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Enviar cadastro
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
