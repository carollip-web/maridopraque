import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PhotoUploader } from "@/components/PhotoUploader";
import { GuestUploader } from "@/components/GuestUploader";
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
  User,
  Users,
  Calendar,
  Sun,
  Moon,
  Sunrise,
} from "lucide-react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { brl } from "./constants";
import { Material, ServiceMaterial, Servico, WizardStep } from "./types";
import type { OrcamentoFormState } from "./useOrcamentoForm";
import { OrcamentoConfirmacao } from "./OrcamentoConfirmacao";

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
    metragemM2,
    setMetragemM2,
    fotos,
    setFotos,
    guestFiles,
    setGuestFiles,
    togglePick,
  } = form;

  const isM2Service = !!selServico && /\(m²?\)|\bm2\b|metro quadrado/i.test(selServico.nome);
  const metragemNum = (() => {
    const v = parseFloat((metragemM2 || "").replace(",", "."));
    return Number.isFinite(v) && v > 0 ? v : 0;
  })();

  return (
    <div className="bg-white rounded-2xl border border-border p-6 mb-6 shadow-soft space-y-5">
      {editingId && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
          <Pencil className="h-4 w-4" /> Editando solicitação enviada — alterações são possíveis até
          o profissional responder.
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
              {i < 4 && <div className="hidden lg:block w-3 md:w-6 h-px bg-slate-200" />}
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
          const totalMin = (isM2Service && metragemNum > 0 ? min * metragemNum : min) + subtotalMat;
          const totalMax = (isM2Service && metragemNum > 0 ? max * metragemNum : max) + subtotalMat;
          const qtdMat = Object.keys(picked).length;
          return (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Resumo
                  </p>
                  <p className="mt-1 font-semibold text-foreground truncate">{selServico.nome}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isM2Service && metragemNum > 0 ? `${metragemNum} m² · ` : ""}
                    {qtdMat > 0 ? `${qtdMat} material(is)` : "Sem materiais"} · {tempo}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {isM2Service && metragemNum > 0 ? "Total estimado" : "Total estimado"}
                  </p>
                  <p className="text-lg font-semibold text-foreground whitespace-nowrap tabular-nums">
                    {min === max ? brl(totalMin) : `${brl(totalMin)} – ${brl(totalMax)}`}
                  </p>
                  {isM2Service && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {brl(min)}–{brl(max)} / m²
                    </p>
                  )}
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
            {selServico && selServico.preco_min != null && selServico.preco_max != null && (
              <p className="text-xs text-muted-foreground mt-2">
                Range tabelado:{" "}
                <span className="font-semibold text-foreground">
                  {brl(Number(selServico.preco_min))} a {brl(Number(selServico.preco_max))}
                  {isM2Service ? " / m²" : ""}
                </span>
                . O profissional confirmará o valor exato dentro desse range.
              </p>
            )}
            {selServico && (selServico.preco_min == null || selServico.preco_max == null) && (
              <p className="text-xs text-amber-700 mt-2">
                Este serviço ainda não tem preço tabelado. Escolha outro item.
              </p>
            )}
          </div>

          {isM2Service && (
            <div className="rounded-2xl border border-brand/20 bg-brand-soft/40 p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-xs uppercase font-bold text-brand flex items-center gap-2">
                <Wrench className="h-3 w-3" /> Metragem do serviço (m²){" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={metragemM2}
                onChange={(e) => setMetragemM2(e.target.value)}
                placeholder="Ex.: 12"
                className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:ring-2 focus:ring-brand/20 outline-none text-base font-semibold"
              />
              {metragemNum > 0 &&
                selServico?.preco_min != null &&
                selServico?.preco_max != null && (
                  <p className="text-xs text-slate-700">
                    Estimativa:{" "}
                    <span className="font-bold text-foreground">
                      {brl(Number(selServico.preco_min) * metragemNum)} –{" "}
                      {brl(Number(selServico.preco_max) * metragemNum)}
                    </span>{" "}
                    ({metragemNum} m² × {brl(Number(selServico.preco_min))}–
                    {brl(Number(selServico.preco_max))}/m²)
                  </p>
                )}
              <p className="text-[11px] text-muted-foreground">
                Informe a área a ser trabalhada. O valor sugerido é calculado automaticamente; o
                profissional confirma o valor final.
              </p>
            </div>
          )}

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
              Opcional, mas ajuda muito o profissional a entender o que precisa ser feito.
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
              <GuestUploader files={guestFiles} setFiles={setGuestFiles} max={5} />
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => form.goToStep2()}
              disabled={!selServiceId || (isM2Service && metragemNum <= 0)}
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
            <h3 className="text-xl font-bold text-slate-800">Escolha o tipo de atendimento</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione a opção que deixa você mais confortável para receber o serviço.
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
                <p className="text-xs text-muted-foreground leading-relaxed pl-13">{opt.desc}</p>
              </label>
            ))}
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="rounded-full gap-2">
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
              Vamos buscar profissionais disponíveis na sua região e no melhor horário para você.
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
                  <span className="text-xs font-bold text-slate-700">{p.label}</span>
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
            <Button variant="outline" onClick={() => setStep(2)} className="rounded-full gap-2">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={
                !dataPreferida || (periodoPreferido === "horario_especifico" && !horarioPreferido)
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
                <span className="text-xs text-muted-foreground">(taxa adicional)</span>
              </div>
              <ul className="space-y-2">
                {sugeridos.map((m) => {
                  const sm = serviceMats.find(
                    (s) => s.service_id === selServiceId && s.material_id === m.id,
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
                            const n = Math.min(1000, Math.max(1, Number(e.target.value) || 1));
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
                  <span className="text-muted-foreground">Subtotal materiais</span>
                  <span className="font-bold">{brl(subtotalMat)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 border border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum material sugerido para este serviço. Você pode seguir para a confirmação.
            </div>
          )}

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep(3)} className="rounded-full gap-2">
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
        <OrcamentoConfirmacao
          form={form}
          selServico={selServico}
          isM2Service={isM2Service}
          metragemNum={metragemNum}
          materiais={materiais}
          subtotalMat={subtotalMat}
          user={user}
        />
      )}
    </div>
  );
}
