import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PhotoUploader } from "@/components/PhotoUploader";
import { GuestUploader } from "@/components/GuestUploader";
import { lovable } from "@/integrations/lovable";
import {
  Loader2,
  CheckCircle2,
  Clock,
  Package,
  ChevronLeft,
  ChevronRight,
  Wrench,
  ClipboardCheck,
  Save,
  Pencil,
  Send,
  User,
  Users,
  Calendar,
  Sun,
  Moon,
  Sunrise,
  Coffee,
  Info,
} from "lucide-react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { brl } from "./constants";
import { Material, ServiceMaterial, Servico, WizardStep } from "./types";
import type { OrcamentoFormState } from "./useOrcamentoForm";

interface OrcamentoWizardProps {
  form: OrcamentoFormState;
  user: AuthUser | null;
  servicos: Servico[];
  materiais: Material[];
  serviceMats: ServiceMaterial[];
  selServico: Servico | undefined;
  sugeridos: Material[];
  subtotalMat: number;
  draftSavedAt: number | null;
}

const STEPS: { n: WizardStep; label: string; icon: any }[] = [
  { n: 1, label: "Serviço", icon: Wrench },
  { n: 2, label: "Atendimento", icon: User },
  { n: 3, label: "Agenda", icon: Calendar },
  { n: 4, label: "Materiais", icon: Package },
  { n: 5, label: "Confirmar", icon: ClipboardCheck },
];

const ATENDIMENTO_OPTS = [
  {
    id: "mulher",
    title: "Profissional mulher",
    desc: "Prefere ser atendida por uma profissional mulher? Vamos verificar a disponibilidade na sua região. Caso não haja agenda disponível, você ainda poderá contar com a opção de apoio feminino durante a visita.",
    icon: <User className="h-5 w-5" />,
    color: "bg-pink-50 text-pink-600 border-pink-100",
    activeColor: "ring-pink-500 bg-pink-50/50 border-pink-200",
  },
  {
    id: "homem",
    title: "Profissional homem",
    desc: "Atendimento com profissional homem selecionado pela habilidade técnica, postura e comportamento. Indicado para serviços que exigem força física, instalações complexas ou manutenções mais pesadas.",
    icon: <User className="h-5 w-5" />,
    color: "bg-blue-50 text-blue-600 border-blue-100",
    activeColor: "ring-blue-500 bg-blue-50/50 border-blue-200",
  },
  {
    id: "homem_com_apoio_feminino",
    title: "Profissional + apoio feminino",
    desc: "Nossa modalidade mais escolhida. O técnico realiza o serviço enquanto uma mulher de apoio acompanha a visita, auxiliando na organização e trazendo mais conforto e segurança dentro da sua casa.",
    icon: <Users className="h-5 w-5" />,
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
    activeColor: "ring-emerald-500 bg-emerald-50/50 border-emerald-200",
  },
];

const PERIODO_OPTS = [
  { id: "manha", label: "Manhã", icon: Sunrise, color: "text-amber-500 bg-amber-50" },
  { id: "tarde", label: "Tarde", icon: Sun, color: "text-orange-500 bg-orange-50" },
  { id: "noite", label: "Noite", icon: Moon, color: "text-indigo-500 bg-indigo-50" },
  {
    id: "horario_especifico",
    label: "Hora exata",
    icon: Clock,
    color: "text-brand bg-brand-soft",
  },
];

export function OrcamentoWizard({
  form,
  user,
  servicos,
  materiais,
  serviceMats,
  selServico,
  sugeridos,
  subtotalMat,
  draftSavedAt,
}: OrcamentoWizardProps) {
  const {
    step,
    setStep,
    editingId,
    saving,
    selServiceId,
    setSelServiceId,
    descricao,
    setDescricao,
    tipoAtendimento,
    setTipoAtendimento,
    dataPreferida,
    setDataPreferida,
    periodoPreferido,
    setPeriodoPreferido,
    horarioPreferido,
    setHorarioPreferido,
    flexibilidadeAgenda,
    setFlexibilidadeAgenda,
    picked,
    setPicked,
    fotos,
    setFotos,
    guestFiles,
    setGuestFiles,
    guestEmail,
    setGuestEmail,
    guestSenha,
    setGuestSenha,
    guestNome,
    setGuestNome,
    togglePick,
    handleNew,
  } = form;

  return (
    <div className="bg-white rounded-2xl border border-border p-6 mb-6 shadow-soft space-y-5">
      {editingId && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
          <Pencil className="h-4 w-4" /> Editando solicitação enviada —
          alterações são possíveis até o profissional responder.
        </div>
      )}
      {!editingId && draftSavedAt && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Save className="h-3 w-3" /> Rascunho salvo automaticamente
        </p>
      )}

      {/* Stepper */}
      <ol className="flex flex-wrap items-center justify-center gap-y-3 gap-x-2 md:gap-x-4 py-2 border-b border-slate-50 pb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = step === s.n;
          const done = step > s.n;
          const canGo = s.n <= step || (s.n > step && !!selServiceId);
          return (
            <li key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => canGo && setStep(s.n)}
                disabled={!canGo}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border transition-all duration-300 ${
                  active
                    ? "bg-brand text-brand-foreground border-brand shadow-md scale-105"
                    : done
                      ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      : "bg-slate-50 text-muted-foreground border-border hover:bg-slate-100"
                } ${canGo ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? "animate-pulse" : ""}`} />
                <span className="text-[11px] md:text-xs font-bold whitespace-nowrap">
                  {s.n}. {s.label}
                </span>
              </button>
              {i < 4 && (
                <div className="hidden lg:block w-3 md:w-6 h-px bg-slate-200" />
              )}
            </li>
          );
        })}
      </ol>

      {/* Resumo dinâmico */}
      {selServico &&
        selServico.preco_min != null &&
        selServico.preco_max != null &&
        (() => {
          const min = Number(selServico.preco_min);
          const max = Number(selServico.preco_max);
          const media = (min + max) / 2;
          const horas = Math.max(0.5, Math.min(8, media / 80));
          const tempo =
            horas < 1
              ? "≈ 30 min"
              : horas < 1.5
                ? "≈ 1 h"
                : horas < 5
                  ? `≈ ${Math.round(horas * 2) / 2} h`
                  : `≈ ${Math.round(horas)} h`;
          const totalMin = min + subtotalMat;
          const totalMax = max + subtotalMat;
          const qtdMat = Object.keys(picked).length;
          return (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Resumo
                  </p>
                  <p className="mt-1 font-semibold text-foreground truncate">
                    {selServico.nome}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {qtdMat > 0 ? `${qtdMat} material(is)` : "Sem materiais"} ·{" "}
                    {tempo}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Total estimado
                  </p>
                  <p className="text-lg font-semibold text-foreground whitespace-nowrap tabular-nums">
                    {min === max
                      ? brl(totalMin)
                      : `${brl(totalMin)} – ${brl(totalMax)}`}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Step 1: Serviço */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground">
              Serviço <span className="text-red-500">*</span>
            </label>
            <select
              value={selServiceId}
              onChange={(e) => {
                const next = e.target.value;
                if (next === selServiceId) return;
                setSelServiceId(next);
                setPicked({});
              }}
              className="w-full mt-1 h-12 px-3 rounded-xl border border-border bg-slate-50"
            >
              <option value="">Selecione um serviço…</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                  {s.preco_min != null && s.preco_max != null
                    ? ` — ${brl(Number(s.preco_min))} a ${brl(Number(s.preco_max))}`
                    : ""}
                </option>
              ))}
            </select>
            {selServico &&
              selServico.preco_min != null &&
              selServico.preco_max != null && (
                <p className="text-xs text-muted-foreground mt-2">
                  Range tabelado:{" "}
                  <span className="font-semibold text-foreground">
                    {brl(Number(selServico.preco_min))} a{" "}
                    {brl(Number(selServico.preco_max))}
                  </span>
                  . O profissional confirmará o valor exato dentro desse range.
                </p>
              )}
            {selServico &&
              (selServico.preco_min == null || selServico.preco_max == null) && (
                <p className="text-xs text-amber-700 mt-2">
                  Este serviço ainda não tem preço tabelado. Escolha outro item.
                </p>
              )}
          </div>

          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground">
              Descrição (opcional)
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={2000}
              placeholder="Ex.: 2 prateleiras na sala, parede de drywall…"
              rows={3}
              className="w-full mt-1 px-4 py-3 rounded-xl border border-border bg-slate-50"
            />
            <p className="text-[11px] text-muted-foreground mt-1 text-right">
              {descricao.length}/2000
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-sm">Fotos e vídeos do problema</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Opcional, mas ajuda muito o profissional a entender o que precisa
              ser feito.
            </p>
            {user ? (
              <PhotoUploader
                userId={user.id}
                pathPrefix="problema"
                value={fotos}
                onChange={setFotos}
                max={5}
                label="adicionar imagem ou vídeo"
                acceptVideo
              />
            ) : (
              <GuestUploader
                files={guestFiles}
                setFiles={setGuestFiles}
                max={5}
              />
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!selServiceId}
              className="rounded-full bg-foreground text-background font-bold gap-2"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Atendimento */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              Escolha o tipo de atendimento
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione a opção que deixa você mais confortável para receber o
              serviço.
            </p>
          </div>

          <div className="grid gap-4">
            {ATENDIMENTO_OPTS.map((opt) => (
              <label
                key={opt.id}
                className={`relative flex flex-col p-5 rounded-3xl border-2 cursor-pointer transition-all hover:shadow-md ${
                  tipoAtendimento === opt.id
                    ? `ring-2 ${opt.activeColor}`
                    : "border-slate-100 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="tipoAtendimento"
                  value={opt.id}
                  checked={tipoAtendimento === opt.id}
                  onChange={(e) => setTipoAtendimento(e.target.value)}
                  className="sr-only"
                />
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`h-10 w-10 rounded-2xl flex items-center justify-center ${opt.color}`}
                  >
                    {opt.icon}
                  </div>
                  <span className="font-bold text-slate-800">{opt.title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-13">
                  {opt.desc}
                </p>
              </label>
            ))}
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="rounded-full gap-2"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!tipoAtendimento}
              className="rounded-full bg-foreground text-background font-bold gap-2"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Agenda */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              Quando você prefere receber o serviço?
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vamos buscar profissionais disponíveis na sua região e no melhor
              horário para você.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3 w-3" /> Data desejada
              </label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={dataPreferida}
                onChange={(e) => setDataPreferida(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-border bg-slate-50 focus:ring-2 focus:ring-brand/20 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" /> Flexibilidade
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "flexivel", label: "Flexível" },
                  { id: "exato", label: "Preciso desse dia/hora" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFlexibilidadeAgenda(opt.id)}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                      flexibilidadeAgenda === opt.id
                        ? "bg-brand/10 border-brand text-brand shadow-sm"
                        : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs uppercase font-bold text-muted-foreground">
              Período de preferência
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PERIODO_OPTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriodoPreferido(p.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                    periodoPreferido === p.id
                      ? "border-brand ring-2 ring-brand/10 bg-white shadow-md scale-[1.02]"
                      : "border-slate-100 bg-slate-50/50 grayscale hover:grayscale-0 hover:border-slate-200"
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center ${p.color}`}
                  >
                    <p.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {periodoPreferido === "horario_especifico" && (
            <div className="space-y-2 animate-in zoom-in-95 duration-200">
              <label className="text-xs uppercase font-bold text-muted-foreground">
                Selecione o horário
              </label>
              <input
                type="time"
                value={horarioPreferido}
                onChange={(e) => setHorarioPreferido(e.target.value)}
                className="w-full max-w-[200px] px-4 py-3 rounded-2xl border border-border bg-slate-50 focus:ring-2 focus:ring-brand/20 outline-none transition-all"
              />
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="rounded-full gap-2"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={
                !dataPreferida ||
                (periodoPreferido === "horario_especifico" && !horarioPreferido)
              }
              className="rounded-full bg-foreground text-background font-bold gap-2"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Materiais */}
      {step === 4 && (
        <div className="space-y-4">
          {sugeridos.length > 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-brand" />
                <h4 className="font-bold text-sm">Materiais opcionais</h4>
                <span className="text-xs text-muted-foreground">
                  (taxa adicional)
                </span>
              </div>
              <ul className="space-y-2">
                {sugeridos.map((m) => {
                  const sm = serviceMats.find(
                    (s) =>
                      s.service_id === selServiceId && s.material_id === m.id,
                  );
                  const qtyDefault = Number(sm?.quantidade_sugerida ?? 1);
                  const checked = m.id in picked;
                  const qty = picked[m.id] ?? qtyDefault;
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 bg-white rounded-xl p-3 border border-border"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePick(m.id, qtyDefault)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {brl(Number(m.preco_atual))} / {m.unidade}
                          {m.preco_fonte === "marketplace" && " · marketplace"}
                        </p>
                      </div>
                      {checked && (
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={qty}
                          onChange={(e) => {
                            const n = Math.min(
                              1000,
                              Math.max(1, Number(e.target.value) || 1),
                            );
                            setPicked((p) => ({ ...p, [m.id]: n }));
                          }}
                          className="w-16 h-9 px-2 rounded-lg border border-border text-sm text-right"
                        />
                      )}
                      {checked && (
                        <span className="text-sm font-bold tabular-nums w-20 text-right">
                          {brl(Number(m.preco_atual) * qty)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {Object.keys(picked).length > 0 && (
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-border text-sm">
                  <span className="text-muted-foreground">
                    Subtotal materiais
                  </span>
                  <span className="font-bold">{brl(subtotalMat)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 border border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum material sugerido para este serviço. Você pode seguir para
              a confirmação.
            </div>
          )}

          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(3)}
              className="rounded-full gap-2"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              onClick={() => setStep(5)}
              className="rounded-full bg-foreground text-background font-bold gap-2"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Confirmar */}
      {step === 5 && selServico && (
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
                      <h4 className="font-bold text-slate-800 leading-tight">
                        {selServico.nome}
                      </h4>
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
                            ? new Date(
                                dataPreferida + "T00:00:00",
                              ).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                              })
                            : "---"}
                          {" · "}
                          <span className="text-muted-foreground">
                            {periodoPreferido === "manha" && "Manhã"}
                            {periodoPreferido === "tarde" && "Tarde"}
                            {periodoPreferido === "noite" && "Noite"}
                            {periodoPreferido === "horario_especifico" &&
                              horarioPreferido}
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
                            <li
                              key={id}
                              className="flex justify-between text-xs"
                            >
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
                      {Number(selServico.preco_min) !==
                        Number(selServico.preco_max) && (
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
                      A partir de{" "}
                      {brl(Number(selServico.preco_min) + subtotalMat)}
                    </span>
                  )}
                </div>

                <div className="mt-6 space-y-3 pt-6 border-t border-brand-foreground/20">
                  <div className="flex justify-between text-xs">
                    <span className="opacity-70">Mão de obra</span>
                    <span className="font-bold">
                      {Number(selServico.preco_max) > 0
                        ? Number(selServico.preco_min) ===
                          Number(selServico.preco_max)
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
                    <p className="text-sm font-bold text-white">
                      Crie sua conta para enviar o pedido
                    </p>
                    <p className="text-xs text-white/70 -mt-1">
                      Rápido — só pra você acompanhar as propostas e pagar com
                      segurança.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                          const r = await lovable.auth.signInWithOAuth(
                            "google",
                            {
                              redirect_uri: `${window.location.origin}/auth/redirect`,
                            },
                          );
                          if (r.error)
                            toast.error(
                              r.error.message ?? "Erro ao entrar com Google",
                            );
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
                          const r = await lovable.auth.signInWithOAuth(
                            "apple",
                            {
                              redirect_uri: `${window.location.origin}/auth/redirect`,
                            },
                          );
                          if (r.error)
                            toast.error(
                              r.error.message ?? "Erro ao entrar com Apple",
                            );
                        }}
                        className="h-12 rounded-xl bg-black hover:bg-black/90 text-white font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
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
                      Já tem conta? Use o mesmo e-mail e senha — vamos te
                      conectar automaticamente.
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
                  <h4 className="font-bold text-sm tracking-tight">
                    Pagamento seguro
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Você só paga depois que o profissional enviar a proposta final
                  e você aprovar. O pagamento será feito pela plataforma, em
                  ambiente seguro.
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
                      <span className="text-[10px] font-medium text-slate-600">
                        {txt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                <Info className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                  O valor final e a disponibilidade da agenda serão confirmados
                  pelo profissional no chat após o recebimento deste pedido.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
