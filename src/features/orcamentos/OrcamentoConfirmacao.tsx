import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import {
  Loader2,
  CheckCircle2,
  Wrench,
  ChevronLeft,
  Send,
  User,
  Users,
  Calendar,
  Info,
} from "lucide-react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { brl } from "./constants";
import type { Material, Servico } from "./types";
import type { OrcamentoFormState } from "./useOrcamentoForm";

interface OrcamentoConfirmacaoProps {
  form: OrcamentoFormState;
  selServico: Servico;
  isM2Service: boolean;
  metragemNum: number;
  materiais: Material[];
  subtotalMat: number;
  user: AuthUser | null;
}

// Passo 5 do wizard: revisão da solicitação, preço estimado e envio
// (com cadastro de visitante quando não há sessão).
export function OrcamentoConfirmacao({
  form,
  selServico,
  isM2Service,
  metragemNum,
  materiais,
  subtotalMat,
  user,
}: OrcamentoConfirmacaoProps) {
  const {
    descricao,
    tipoAtendimento,
    dataPreferida,
    periodoPreferido,
    horarioPreferido,
    picked,
    saving,
    guestNome,
    setGuestNome,
    guestEmail,
    setGuestEmail,
    guestSenha,
    setGuestSenha,
    handleNew,
    setStep,
  } = form;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">
          Revise sua solicitação
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Confira os detalhes abaixo antes de enviar para os profissionais.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Coluna esquerda */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                O que será feito
              </p>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-brand/5 flex items-center justify-center text-brand shrink-0">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 leading-tight">{selServico.nome}</h4>
                  {isM2Service && metragemNum > 0 && (
                    <p className="mt-1 text-xs font-semibold text-brand">Área: {metragemNum} m²</p>
                  )}
                  {descricao.trim() && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-3 italic">
                      "{descricao}"
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-50">
              <div className="px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Atendimento
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs ${
                      tipoAtendimento === "mulher"
                        ? "bg-pink-100 text-pink-600"
                        : tipoAtendimento === "homem"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {tipoAtendimento === "homem_com_apoio_feminino" ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-700">
                    {tipoAtendimento === "mulher"
                      ? "Profissional mulher"
                      : tipoAtendimento === "homem"
                        ? "Profissional homem"
                        : "Profissional + apoio feminino"}
                  </span>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Agenda Desejada
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-brand-soft flex items-center justify-center text-brand">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      {dataPreferida
                        ? new Date(dataPreferida + "T00:00:00").toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "---"}
                      {" · "}
                      <span className="text-muted-foreground">
                        {periodoPreferido === "manha" && "Manhã"}
                        {periodoPreferido === "tarde" && "Tarde"}
                        {periodoPreferido === "noite" && "Noite"}
                        {periodoPreferido === "horario_especifico" && horarioPreferido}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {Object.keys(picked).length > 0 && (
              <div className="px-6 py-5 border-t border-slate-50 bg-slate-50/30">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Materiais Selecionados ({Object.keys(picked).length})
                </p>
                <ul className="space-y-2">
                  {Object.entries(picked)
                    .slice(0, 3)
                    .map(([id, qty]) => {
                      const m = materiais.find((x) => x.id === id);
                      if (!m) return null;
                      return (
                        <li key={id} className="flex justify-between text-xs">
                          <span className="text-slate-600 truncate mr-4">
                            {m.nome}{" "}
                            <span className="opacity-50">
                              · {qty} {m.unidade}
                            </span>
                          </span>
                          <span className="font-bold tabular-nums text-slate-800">
                            {brl(Number(m.preco_atual) * qty)}
                          </span>
                        </li>
                      );
                    })}
                  {Object.keys(picked).length > 3 && (
                    <li className="text-[10px] text-brand font-bold">
                      + {Object.keys(picked).length - 3} outros itens
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita: preço + CTA */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-brand text-brand-foreground rounded-3xl p-6 shadow-lg shadow-brand/20">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">
              Investimento Estimado
            </p>
            <div className="flex items-baseline gap-1">
              {Number(selServico.preco_max) > 0 ? (
                <>
                  <span className="text-3xl font-black tabular-nums">
                    {brl(Number(selServico.preco_min) + subtotalMat)}
                  </span>
                  {Number(selServico.preco_min) !== Number(selServico.preco_max) && (
                    <>
                      <span className="text-lg opacity-60 font-bold">até</span>
                      <span className="text-3xl font-black tabular-nums">
                        {brl(Number(selServico.preco_max) + subtotalMat)}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-3xl font-black tabular-nums">
                  A partir de {brl(Number(selServico.preco_min) + subtotalMat)}
                </span>
              )}
            </div>

            <div className="mt-6 space-y-3 pt-6 border-t border-brand-foreground/20">
              <div className="flex justify-between text-xs">
                <span className="opacity-70">Mão de obra</span>
                <span className="font-bold">
                  {Number(selServico.preco_max) > 0
                    ? Number(selServico.preco_min) === Number(selServico.preco_max)
                      ? brl(Number(selServico.preco_min))
                      : `${brl(Number(selServico.preco_min))} – ${brl(Number(selServico.preco_max))}`
                    : `A partir de ${brl(Number(selServico.preco_min))}`}
                </span>
              </div>
              {subtotalMat > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="opacity-70">Materiais</span>
                  <span className="font-bold">{brl(subtotalMat)}</span>
                </div>
              )}
            </div>

            {!user && (
              <div className="mt-6 space-y-3 pt-6 border-t border-brand-foreground/20">
                <p className="text-sm font-bold text-white">Crie sua conta para enviar o pedido</p>
                <p className="text-xs text-white/70 -mt-1">
                  Rápido — só pra você acompanhar as propostas e pagar com segurança.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      const r = await lovable.auth.signInWithOAuth("google", {
                        redirect_uri: `${window.location.origin}/auth/redirect`,
                      });
                      if (r.error) toast.error(r.error.message ?? "Erro ao entrar com Google");
                    }}
                    className="h-12 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      const r = await lovable.auth.signInWithOAuth("apple", {
                        redirect_uri: `${window.location.origin}/auth/redirect`,
                      });
                      if (r.error) toast.error(r.error.message ?? "Erro ao entrar com Apple");
                    }}
                    className="h-12 rounded-xl bg-black hover:bg-black/90 text-white font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    Apple
                  </button>
                </div>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/20" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-brand px-3 text-[10px] uppercase tracking-widest text-white/70 font-bold">
                      ou com e-mail
                    </span>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Seu nome"
                  value={guestNome}
                  onChange={(e) => setGuestNome(e.target.value)}
                  className="w-full rounded-xl h-12 px-4 text-slate-800 bg-white placeholder:text-slate-400 outline-none"
                />
                <input
                  type="email"
                  placeholder="Seu melhor e-mail"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full rounded-xl h-12 px-4 text-slate-800 bg-white placeholder:text-slate-400 outline-none"
                />
                <input
                  type="password"
                  placeholder="Crie uma senha"
                  value={guestSenha}
                  onChange={(e) => setGuestSenha(e.target.value)}
                  className="w-full rounded-xl h-12 px-4 text-slate-800 bg-white placeholder:text-slate-400 outline-none"
                />
                <p className="text-[11px] text-white/60">
                  Já tem conta? Use o mesmo e-mail e senha — vamos te conectar automaticamente.
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3">
              <Button
                onClick={handleNew}
                disabled={saving}
                className="w-full bg-white text-brand hover:bg-slate-50 rounded-2xl h-14 font-black text-base gap-3 shadow-xl"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Enviar solicitação <Send className="h-5 w-5" />
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep(4)}
                className="w-full text-brand-foreground/80 hover:text-white hover:bg-brand-foreground/10 rounded-xl"
                disabled={saving}
              >
                <ChevronLeft className="h-4 w-4 mr-2" /> Revisar materiais
              </Button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-800">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-sm tracking-tight">Pagamento seguro</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Você só paga depois que o profissional enviar a proposta final e você aprovar. O
              pagamento será feito pela plataforma, em ambiente seguro.
            </p>
            <div className="space-y-2">
              {[
                "Envie sua solicitação",
                "Receba a proposta do profissional",
                "Aprove o orçamento",
                "Pague com segurança",
              ].map((txt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full bg-slate-200 text-[8px] flex items-center justify-center font-bold text-slate-500 shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-[10px] font-medium text-slate-600">{txt}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
            <Info className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              O valor final e a disponibilidade da agenda serão confirmados pelo profissional no
              chat após o recebimento deste pedido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
