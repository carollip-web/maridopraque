import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, User, MapPin, Sparkles, FileCheck2 } from "lucide-react";

export const TERMO_VERSAO = "1.0";

const STEPS = [
  { key: "dados", title: "Seus dados", icon: User },
  { key: "atendimento", title: "Onde você atende", icon: MapPin },
  { key: "perfil", title: "Foto, bio e especialidades", icon: Sparkles },
  { key: "termo", title: "Termo de adesão", icon: FileCheck2 },
] as const;

const ESPECIALIDADES_SUGERIDAS = [
  "Elétrica", "Hidráulica", "Pintura", "Marido de Aluguel", "Montagem de Móveis",
  "Reparos Gerais", "Instalações", "Pequenas Reformas", "Jardinagem", "Limpeza Pesada",
];

export function OnboardingWizard() {
  const { user, profile, refresh } = useAuth() as any;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cidade, setCidade] = useState("");
  const [raio, setRaio] = useState<number>(15);
  const [bio, setBio] = useState("");
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [termoAceito, setTermoAceito] = useState(false);

  // Verifica se onboarding já foi completado
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (!user) return;
      setLoading(true);
      const { data: perfil } = await supabase
        .from("profissional_perfil")
        .select("bio, cidade, especialidades, raio_atendimento_km, onboarding_completo")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      // Pré-preenche
      setNome(profile?.nome ?? "");
      setWhatsapp(profile?.whatsapp ?? "");
      setCidade(perfil?.cidade ?? "");
      setRaio(perfil?.raio_atendimento_km ?? 15);
      setBio(perfil?.bio ?? "");
      setEspecialidades(perfil?.especialidades ?? []);
      if (!perfil?.onboarding_completo) setOpen(true);
      setLoading(false);
    };
    check();
    return () => { alive = false; };
  }, [user?.id, profile?.nome, profile?.whatsapp]);

  const canNext = useMemo(() => {
    if (step === 0) return nome.trim().length >= 2 && whatsapp.replace(/\D/g, "").length >= 10;
    if (step === 1) return cidade.trim().length >= 2 && raio > 0;
    if (step === 2) return bio.trim().length >= 20 && especialidades.length > 0;
    if (step === 3) return termoAceito;
    return false;
  }, [step, nome, whatsapp, cidade, raio, bio, especialidades, termoAceito]);

  const toggleEspec = (e: string) => {
    setEspecialidades((cur) => cur.includes(e) ? cur.filter(x => x !== e) : [...cur, e]);
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const wp = whatsapp.replace(/\D/g, "");
      // 1. profile (nome, whatsapp)
      const { error: e1 } = await supabase
        .from("profiles")
        .update({ nome: nome.trim(), whatsapp: wp })
        .eq("id", user.id);
      if (e1) throw e1;

      // 2. upsert profissional_perfil
      const { error: e2 } = await supabase
        .from("profissional_perfil")
        .upsert({
          user_id: user.id,
          cidade: cidade.trim(),
          raio_atendimento_km: raio,
          bio: bio.trim(),
          especialidades,
          termo_aceito_em: new Date().toISOString(),
          termo_versao: TERMO_VERSAO,
          onboarding_completo: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      if (e2) throw e2;

      toast.success("Bem-vindo a bordo!", { description: "Seu perfil profissional está pronto." });
      setOpen(false);
      refresh?.();
    } catch (err: any) {
      toast.error("Erro ao finalizar", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return null;

  const Icon = STEPS[step].icon;
  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <Dialog open={open} onOpenChange={() => { /* não permite fechar até finalizar */ }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <div className="bg-gradient-to-br from-brand to-orange-500 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-white/20 grid place-items-center">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-white/80">Passo {step + 1} de {STEPS.length}</p>
                <DialogTitle className="text-white text-lg">{STEPS[step].title}</DialogTitle>
              </div>
            </div>
            <Progress value={pct} className="h-1.5 bg-white/20" />
            <DialogDescription className="text-white/90 text-sm mt-2">
              {step === 0 && "Vamos começar pelo básico para o cliente te encontrar."}
              {step === 1 && "Defina sua área de atendimento para receber chamados próximos."}
              {step === 2 && "Capriche aqui — perfis completos recebem até 3x mais pedidos."}
              {step === 3 && "Para garantir confiança, leia e aceite nosso termo de adesão."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ow-nome">Nome de exibição</Label>
                <Input id="ow-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como o cliente te verá" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ow-wp">WhatsApp profissional</Label>
                <Input id="ow-wp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
                <p className="text-xs text-muted-foreground">Usado para falar com clientes durante o serviço.</p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ow-cid">Cidade base</Label>
                <Input id="ow-cid" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: São Paulo - SP" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ow-raio">Raio de atendimento: <span className="font-bold text-brand">{raio} km</span></Label>
                <input
                  id="ow-raio"
                  type="range" min={1} max={50} value={raio}
                  onChange={(e) => setRaio(Number(e.target.value))}
                  className="w-full accent-brand"
                />
                <p className="text-xs text-muted-foreground">Você só receberá pedidos dentro deste raio.</p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ow-bio">Bio (mínimo 20 caracteres)</Label>
                <Textarea
                  id="ow-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                  placeholder="Ex: 8 anos como marido de aluguel, especialista em elétrica residencial e pequenos reparos. Atendo com agilidade e capricho."
                />
                <p className="text-xs text-muted-foreground">{bio.length}/20</p>
              </div>
              <div className="space-y-1.5">
                <Label>Especialidades</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ESPECIALIDADES_SUGERIDAS.map((e) => {
                    const on = especialidades.includes(e);
                    return (
                      <button
                        key={e} type="button" onClick={() => toggleEspec(e)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? "bg-brand text-white border-brand" : "bg-white text-slate-700 border-slate-200 hover:border-brand"}`}
                      >
                        {e}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Você pode adicionar a foto de perfil depois em Configurações.</p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-xl border border-border bg-slate-50 p-4 text-xs text-slate-700 space-y-2 max-h-64 overflow-y-auto">
                <p className="font-bold text-sm text-slate-900">Termo de Adesão e Responsabilidade — versão {TERMO_VERSAO}</p>
                <p>Ao aceitar este termo, eu, profissional cadastrado, declaro que:</p>
                <p><strong>1. Autonomia.</strong> Atuo como prestador autônomo, sem vínculo empregatício com a plataforma. Sou responsável pelos meus tributos, INSS e demais obrigações fiscais.</p>
                <p><strong>2. Capacitação.</strong> Possuo conhecimento técnico, ferramentas e EPIs adequados para os serviços que aceitar. Não aceitarei serviços fora da minha competência.</p>
                <p><strong>3. Responsabilidade integral.</strong> Sou inteira e exclusivamente responsável pela execução, qualidade, segurança e eventuais danos causados durante o serviço, isentando a plataforma de qualquer reparação a terceiros.</p>
                <p><strong>4. Conduta.</strong> Comprometo-me com pontualidade, respeito, honestidade e sigilo das informações do cliente. O descumprimento pode levar à suspensão.</p>
                <p><strong>5. Preço e pagamento.</strong> Aceito a tabela vigente da plataforma e o repasse na forma e prazos divulgados. Não cobrarei valores adicionais por fora sem autorização.</p>
                <p><strong>6. Cancelamento.</strong> Posso recusar serviços, mas o cancelamento após aceite injustificado pode gerar penalidades.</p>
                <p><strong>7. Dados.</strong> Autorizo o uso de meus dados de perfil, avaliações e histórico para fins de operação e marketing da plataforma, conforme LGPD.</p>
                <p><strong>8. Validade.</strong> Este termo permanece válido enquanto eu mantiver cadastro ativo. Atualizações serão notificadas e exigirão novo aceite.</p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <Checkbox checked={termoAceito} onCheckedChange={(v) => setTermoAceito(v === true)} className="mt-0.5" />
                <span className="text-sm font-medium text-slate-900">
                  Li, entendi e <strong>aceito integralmente</strong> os termos acima, assumindo total responsabilidade pelos serviços que prestar.
                </span>
              </label>
            </>
          )}
        </div>

        <div className="border-t border-border p-4 flex items-center justify-between gap-2 bg-slate-50">
          <Button
            variant="ghost" disabled={step === 0 || saving}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              disabled={!canNext}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="bg-brand hover:bg-brand-700 text-white rounded-full font-bold"
            >
              Continuar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              disabled={!canNext || saving}
              onClick={handleFinish}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Concluir cadastro
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
