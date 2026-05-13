import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  CreditCard,
  QrCode,
  Wallet,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  Lock,
  Camera,
  Video,
  Calendar as CalendarIcon,
  Clock,
  Upload,
  ChevronRight,
  Info,
  User,
  Wrench,
  HeartHandshake,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout")({
  component: CheckoutGuard,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      service: (search.service as string) || "Serviço Geral",
      price: Number(search.price) || 120,
      step: Number(search.step) || 1,
    };
  },
});

function CheckoutGuard() {
  const enabled = import.meta.env.VITE_ENABLE_CHECKOUT === "true";
  if (!enabled) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Checkout online em breve
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            O pagamento online ainda não está disponível. Acompanhe seus pedidos ou solicite um
            orçamento — o pagamento é combinado diretamente com o profissional.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/servicos"
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Ver serviços
            </Link>
            <Link
              to="/cliente"
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground"
            >
              Meus pedidos
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return <Checkout />;
}

function Checkout() {
  const { service, price: basePrice, step } = Route.useSearch();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const setStep = (newStep: number) => {
    navigate({ to: "/checkout", search: { service, price: basePrice, step: newStep } });
  };
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedProf, setSelectedProf] = useState<string | null>(null);
  const [showProfInfoModal, setShowProfInfoModal] = useState(false);
  const [files, setFiles] = useState<{ name: string; type: string }[]>([]);

  const upfrontPercentage = 0.5;
  const upfrontAmount = basePrice * upfrontPercentage;
  const remainingAmount = basePrice - upfrontAmount;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((f) => ({ name: f.name, type: f.type }));
      setFiles([...files, ...newFiles]);
    }
  };

  const handlePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep(5);
    }, 2000);
  };

  if (step === 5) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-bold">Agendamento Confirmado!</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Sua reserva para <span className="font-semibold text-foreground">{service}</span> foi
          realizada.
        </p>
        <div className="mt-8 rounded-2xl bg-muted p-6 text-left space-y-2">
          <p className="text-sm">
            <strong>Data:</strong> {selectedDate}
          </p>
          <p className="text-sm">
            <strong>Horário:</strong> {selectedTime}
          </p>
          <p className="text-sm">
            <strong>Sinal Pago:</strong> R$ {upfrontAmount.toFixed(2)}
          </p>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          O saldo restante de <strong>R$ {remainingAmount.toFixed(2)}</strong> será pago diretamente
          ao profissional após a conclusão do serviço.
        </p>
        <div className="mt-10 flex flex-col gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/">Voltar para a Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-12 flex items-center justify-between">
        <Link
          to="/servicos"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="flex items-center gap-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step >= s ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {s}
              </div>
              {s < 4 && <div className={`h-px w-8 ${step > s ? "bg-brand" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <div className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:flex">
          <Lock className="h-3 w-3" /> Checkout Seguro
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-12">
          {/* Step 1: Media & Details */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h2 className="text-3xl font-bold mb-8">1. Detalhes do Reparo</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Envie fotos ou vídeos do que precisa ser feito
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-8 transition hover:border-brand/40 hover:bg-brand-soft/20 cursor-pointer">
                      <Camera className="h-8 w-8 text-brand" />
                      <span className="text-sm font-medium">Incluir Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-8 transition hover:border-brand/40 hover:bg-brand-soft/20 cursor-pointer">
                      <Video className="h-8 w-8 text-brand" />
                      <span className="text-sm font-medium">Incluir Vídeo</span>
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                  {files.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {files.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs"
                        >
                          <Upload className="h-3 w-3" /> {f.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Observações Adicionais (opcional)
                  </label>
                  <textarea
                    placeholder="Ex: Preciso que traga parafusos de bucha 8..."
                    className="w-full min-h-[120px] rounded-2xl border border-border bg-card p-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <Button
                  onClick={() => setStep(2)}
                  className="w-full md:w-auto px-10 h-14 rounded-full"
                >
                  Próximo Passo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Professional Choice */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h2 className="text-3xl font-bold mb-2">2. Escolha do Profissional</h2>
              <p className="text-muted-foreground mb-8">
                Personalize seu atendimento para maior conforto e segurança.
              </p>

              <div className="space-y-4">
                {[
                  {
                    id: "mulher",
                    icon: User,
                    title: "Profissional mulher",
                    desc: "Atendimento feito por uma profissional mulher do início ao fim.",
                    color: "bg-pink-50 text-pink-600",
                  },
                  {
                    id: "homem",
                    icon: Wrench,
                    title: "Profissional homem",
                    desc: "Equipe masculina, qualificada e verificada para qualquer serviço.",
                    color: "bg-slate-100 text-slate-600",
                  },
                  {
                    id: "acompanhante",
                    icon: HeartHandshake,
                    title: "Homem + acompanhante feminina",
                    desc: "Pensado para quem mora sozinha: o profissional vem com uma acompanhante mulher.",
                    color: "bg-brand-soft text-brand",
                    highlight: true,
                  },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProf(p.id);
                      if (p.id === "mulher") setShowProfInfoModal(true);
                    }}
                    className={`w-full flex items-center gap-6 p-6 rounded-3xl border text-left transition ${
                      selectedProf === p.id
                        ? "border-brand bg-brand-soft/20 ring-1 ring-brand"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${p.color}`}
                    >
                      <p.icon className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-lg">{p.title}</h4>
                        {p.highlight && (
                          <span className="bg-brand text-brand-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Diferencial
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{p.desc}</p>
                      <span className="text-[10px] font-bold text-brand uppercase tracking-widest mt-2 block">
                        Saiba mais
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 mt-10">
                <Button variant="ghost" onClick={() => setStep(1)} className="rounded-full">
                  Voltar
                </Button>
                <Button
                  disabled={!selectedProf}
                  onClick={() => setStep(3)}
                  className="flex-1 h-14 rounded-full"
                >
                  Confirmar Profissional <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h2 className="text-3xl font-bold mb-8">3. Agendamento</h2>
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-medium mb-4">Selecione uma data</label>
                  <div className="grid grid-cols-4 gap-3 md:grid-cols-7">
                    {["Seg, 08", "Ter, 09", "Qua, 10", "Qui, 11", "Sex, 12", "Sáb, 13"].map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedDate(d)}
                        className={`rounded-xl border p-3 text-center transition ${
                          selectedDate === d
                            ? "border-brand bg-brand-soft ring-1 ring-brand"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                          {d.split(", ")[0]}
                        </span>
                        <span className="text-lg font-bold">{d.split(", ")[1]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-4">Selecione o período</label>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {["08:00 - 10:00", "10:00 - 12:00", "14:00 - 16:00", "16:00 - 18:00"].map(
                      (t) => (
                        <button
                          key={t}
                          onClick={() => setSelectedTime(t)}
                          className={`rounded-xl border p-4 text-sm font-medium transition ${
                            selectedTime === t
                              ? "border-brand bg-brand-soft ring-1 ring-brand"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {t}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(2)} className="rounded-full">
                    Voltar
                  </Button>
                  <Button
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => setStep(4)}
                    className="flex-1 h-14 rounded-full"
                  >
                    Confirmar Data <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h2 className="text-3xl font-bold mb-8">4. Pagamento do Sinal</h2>
              <div className="space-y-8">
                <div className="rounded-2xl bg-brand-soft/30 p-6 flex gap-4">
                  <Info className="h-5 w-5 text-brand shrink-0" />
                  <p className="text-sm leading-relaxed">
                    Para garantir o agendamento, solicitamos o pagamento antecipado de{" "}
                    <strong>50% do valor da mão de obra</strong>. O saldo restante será pago após a
                    execução do serviço.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { id: "pix", icon: QrCode, label: "Pix", sub: "Confirmação na hora" },
                    { id: "card", icon: CreditCard, label: "Cartão", sub: "Checkout Seguro" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex flex-col items-center rounded-2xl border p-6 transition ${
                        paymentMethod === m.id
                          ? "border-brand bg-brand-soft ring-1 ring-brand"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      <m.icon
                        className={`h-6 w-6 mb-3 ${paymentMethod === m.id ? "text-brand" : "text-muted-foreground"}`}
                      />
                      <span className="font-bold">{m.label}</span>
                      <span className="text-[10px] font-medium text-muted-foreground mt-1 text-center">
                        {m.sub}
                      </span>
                    </button>
                  ))}
                </div>

                {paymentMethod === "pix" && (
                  <div className="rounded-3xl border border-border p-8 text-center animate-in fade-in zoom-in duration-300">
                    <QrCode className="mx-auto h-32 w-32 mb-4" />
                    <p className="text-sm font-medium">
                      Escaneie para pagar R$ {upfrontAmount.toFixed(2)}
                    </p>
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted p-3 text-[10px] font-mono">
                      00020126360014BR.GOV.BCB.PIX...
                      <Button size="sm" variant="ghost" className="h-6">
                        Copiar
                      </Button>
                    </div>
                  </div>
                )}

                {paymentMethod === "card" && (
                  <div className="space-y-4 rounded-3xl border border-border p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="grid gap-4 text-sm">
                      <input
                        placeholder="Número do Cartão"
                        className="w-full rounded-xl border border-border p-3 focus:ring-2 focus:ring-brand/20 outline-none"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          placeholder="MM/AA"
                          className="w-full rounded-xl border border-border p-3 focus:ring-2 focus:ring-brand/20 outline-none"
                        />
                        <input
                          placeholder="CVV"
                          className="w-full rounded-xl border border-border p-3 focus:ring-2 focus:ring-brand/20 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(3)} className="rounded-full">
                    Voltar
                  </Button>
                  <Button
                    disabled={!paymentMethod || isProcessing}
                    onClick={handlePayment}
                    className="flex-1 h-14 rounded-full shadow-brand"
                  >
                    {isProcessing ? "Processando..." : `Pagar R$ ${upfrontAmount.toFixed(2)}`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Summary */}
        <div className="h-fit sticky top-24 rounded-[2rem] border border-border bg-card p-8 shadow-soft">
          <h2 className="text-xl font-bold mb-6">Sua Reserva</h2>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Serviço</span>
              <span className="font-semibold">{service}</span>
            </div>
            {selectedDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data</span>
                <span className="font-semibold text-brand">{selectedDate}</span>
              </div>
            )}
            {selectedProf && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preferência</span>
                <span className="font-semibold text-brand capitalize">{selectedProf}</span>
              </div>
            )}
            <div className="pt-4 border-t border-border flex justify-between">
              <span>Valor Total</span>
              <span className="font-bold">R$ {basePrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-brand font-bold">
              <span>Sinal (50%)</span>
              <span>R$ {upfrontAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground italic">
              <span>Saldo no local</span>
              <span>R$ {remainingAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-border space-y-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-brand" />
              Agendamento garantido com sinal.
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Lock className="h-4 w-4 text-brand" />
              Dados protegidos com SSL 256 bits.
            </div>
            <div className="flex items-start gap-3 text-[10px] text-muted-foreground pt-4 border-t border-border italic leading-relaxed">
              <Info className="h-3.5 w-3.5 text-brand shrink-0" />
              Prefere atendimento por uma profissional mulher? Sem problema! Vamos verificar a
              disponibilidade na sua região. Caso não haja, você ainda pode contar com a opção de
              uma acompanhante para sua segurança e conforto.
            </div>
          </div>
        </div>

        {/* Professional Info Modal */}
        {showProfInfoModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowProfInfoModal(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 p-8 md:p-10 text-center">
              <div className="h-20 w-20 rounded-3xl bg-pink-50 text-pink-500 flex items-center justify-center mx-auto mb-6">
                <User className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Atendimento Feminino</h3>
              <p className="text-slate-600 leading-relaxed mb-8">
                Prefere atendimento por uma profissional mulher? Sem problema! Vamos verificar a
                disponibilidade na sua região.
                <br />
                <br />
                Caso não haja, você ainda pode contar com a opção de uma acompanhante para sua
                segurança e conforto.
              </p>
              <Button
                onClick={() => setShowProfInfoModal(false)}
                className="w-full bg-brand text-white rounded-full h-14 font-bold text-lg shadow-lg"
              >
                Entendido
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
