import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CheckCircle2, AlertCircle, Loader2, QrCode, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PixProfileData {
  pix_key_type: string | null;
  pix_key: string | null;
  pix_holder_name: string | null;
  pix_holder_document: string | null;
  pix_dados_confirmados: boolean;
  repasse_automatico: boolean;
}

export function PixRepasseSettings() {
  const [profile, setProfile] = useState<PixProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [keyType, setKeyType] = useState<string>("");
  const [key, setKey] = useState<string>("");
  const [holderName, setHolderName] = useState<string>("");
  const [holderDocument, setHolderDocument] = useState<string>("");
  const [autoRepasse, setAutoRepasse] = useState<boolean>(true);

  const loadProfile = async () => {
    try {
      setErrorMsg(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profissional_perfil")
        .select(
          "pix_key_type, pix_key, pix_holder_name, pix_holder_document, pix_dados_confirmados, repasse_automatico",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        setErrorMsg("Erro ao carregar perfil profissional.");
        return;
      }

      if (!data) {
        setErrorMsg("Perfil profissional não encontrado.");
        return;
      }

      setProfile({
        pix_key_type: data.pix_key_type,
        pix_key: data.pix_key,
        pix_holder_name: data.pix_holder_name,
        pix_holder_document: data.pix_holder_document,
        pix_dados_confirmados: data.pix_dados_confirmados ?? false,
        repasse_automatico: data.repasse_automatico ?? true,
      });

      setKeyType(data.pix_key_type ?? "");
      setKey(data.pix_key ?? "");
      setHolderName(data.pix_holder_name ?? "");
      setHolderDocument(data.pix_holder_document ?? "");
      setAutoRepasse(data.repasse_automatico ?? true);
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro inesperado ao carregar dados Pix.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!keyType) {
      toast.error("O tipo da chave Pix é obrigatório.");
      return;
    }
    if (!key.trim()) {
      toast.error("A chave Pix é obrigatória.");
      return;
    }
    if (!holderName.trim()) {
      toast.error("O nome do titular é obrigatório.");
      return;
    }
    if (!holderDocument.trim()) {
      toast.error("O documento (CPF/CNPJ) do titular é obrigatório.");
      return;
    }

    // Custom validations
    const cleanKey = key.replace(/\s+/g, "");
    const cleanDoc = holderDocument.replace(/\D/g, "");

    if (keyType === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanKey)) {
        toast.error("Formato de e-mail inválido para a chave Pix.");
        return;
      }
    }

    if (keyType === "cpf") {
      const cleanPixKey = key.replace(/\D/g, "");
      if (cleanPixKey.length < 11) {
        toast.error("A chave Pix do tipo CPF exige pelo menos 11 dígitos.");
        return;
      }
    }

    if (keyType === "cnpj") {
      const cleanPixKey = key.replace(/\D/g, "");
      if (cleanPixKey.length < 14) {
        toast.error("A chave Pix do tipo CNPJ exige pelo menos 14 dígitos.");
        return;
      }
    }

    if (keyType === "phone") {
      const cleanPixKey = key.replace(/\D/g, "");
      if (cleanPixKey.length < 10) {
        toast.error("A chave Pix do tipo Telefone exige pelo menos 10 dígitos com DDD.");
        return;
      }
    }

    // Document length validation
    if (cleanDoc.length < 11) {
      toast.error("O CPF/CNPJ do titular deve conter pelo menos 11 dígitos.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado.");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("profissional_perfil")
        .update({
          pix_key_type: keyType,
          pix_key: key,
          pix_holder_name: holderName,
          pix_holder_document: holderDocument,
          repasse_automatico: autoRepasse,
          pix_dados_confirmados: true,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Dados Pix salvos com sucesso.");

      setProfile({
        pix_key_type: keyType,
        pix_key: key,
        pix_holder_name: holderName,
        pix_holder_document: holderDocument,
        pix_dados_confirmados: true,
        repasse_automatico: autoRepasse,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Falha ao salvar dados Pix.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center border-border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando dados Pix...</span>
      </Card>
    );
  }

  if (errorMsg) {
  if (profile?.pix_dados_confirmados) {
    return null;
  }

  return (
      <Card className="p-6 border-destructive bg-destructive/5 text-destructive space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          <span>Atenção</span>
        </div>
        <p className="text-sm">{errorMsg}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6 border-border shadow-sm bg-card transition-all duration-300 hover:shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Dados Pix para Repasse
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Gerencie as informações da chave Pix que você utiliza para receber os repasses do BTG.
          </p>
        </div>
        <div>
          {profile?.pix_dados_confirmados ? (
            <Badge
              variant="secondary"
              className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 gap-1.5 py-1 px-3"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Pix confirmado
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 gap-1.5 py-1 px-3"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Pix pendente
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 p-4 flex gap-3 text-sm">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-primary-foreground/90 dark:text-primary-foreground/80 space-y-1">
          <p className="font-semibold text-primary dark:text-primary-foreground">
            Aviso Importante
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Esses dados serão usados para enviar seus repasses Pix após a conclusão dos serviços.
            Certifique-se de que a chave pertence ao titular informado.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pix_key_type" className="text-sm font-medium">
              Tipo da chave Pix
            </Label>
            <Select value={keyType} onValueChange={setKeyType}>
              <SelectTrigger id="pix_key_type" className="h-10">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="random">Chave aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix_key" className="text-sm font-medium">
              Chave Pix
            </Label>
            <Input
              id="pix_key"
              type="text"
              placeholder={
                keyType === "cpf"
                  ? "000.000.000-00"
                  : keyType === "cnpj"
                    ? "00.000.000/0000-00"
                    : keyType === "email"
                      ? "seu@email.com"
                      : keyType === "phone"
                        ? "(00) 90000-0000"
                        : "Insira sua chave Pix"
              }
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pix_holder_name" className="text-sm font-medium">
              Nome do titular da conta
            </Label>
            <Input
              id="pix_holder_name"
              type="text"
              placeholder="Nome completo do titular"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix_holder_document" className="text-sm font-medium">
              CPF/CNPJ do titular
            </Label>
            <Input
              id="pix_holder_document"
              type="text"
              placeholder="Apenas números"
              value={holderDocument}
              onChange={(e) => setHolderDocument(e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="repasse_automatico" className="text-sm font-semibold cursor-pointer">
              Repasse automático
            </Label>
            <p className="text-xs text-muted-foreground">
              Enviar o repasse Pix automaticamente assim que o serviço for finalizado e pago.
            </p>
          </div>
          <Switch id="repasse_automatico" checked={autoRepasse} onCheckedChange={setAutoRepasse} />
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto h-10 px-6 font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
              </>
            ) : (
              "Salvar dados Pix"
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
