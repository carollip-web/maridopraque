import { User, MapPin, FileText, Camera, Briefcase, Send, CheckCircle2 } from "lucide-react";

export const STEPS = [
  { id: 1, label: "Dados pessoais", icon: User },
  { id: 2, label: "Endereço", icon: MapPin },
  { id: 3, label: "Experiência", icon: Briefcase },
  { id: 4, label: "Documentos", icon: FileText },
  { id: 5, label: "Revisão", icon: Send },
];

export const ESPECIALIDADES_OPCOES = [
  "chaveiro",
  "elétrica",
  "engenharia",
  "hidráulica",
  "instalação",
  "montagem",
  "reparos",
];

export const ESPECIALIDADES_LABEL: Record<string, string> = {
  chaveiro: "Chaveiro",
  elétrica: "Elétrica",
  engenharia: "Engenharia",
  hidráulica: "Hidráulica",
  instalação: "Instalação",
  montagem: "Montagem de Móveis",
  reparos: "Reparos Gerais",
};

export const COMO_CONHECEU = [
  "Instagram",
  "Google",
  "Indicação de amigo",
  "Facebook",
  "LinkedIn",
  "Panfleto",
  "Outro",
];

export type FormData = {
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

export function emptyForm(): FormData {
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

export function fmtCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function fmtCnpj(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function isValidCnpj(v: string) {
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

export function isValidCpf(v: string) {
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

export function isAdult(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 18 && age <= 100;
}

export function fmtPhone(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{4})$/, "$1-$2");
}

export function fmtCep(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function FileUploadBox({
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
