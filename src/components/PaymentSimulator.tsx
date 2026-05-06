import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, QrCode, Wallet, CheckCircle2, ArrowRight } from "lucide-react";

export function PaymentSimulator() {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState("pix");
  const [service, setService] = useState("Montagem de móveis");
  const [professional, setProfessional] = useState("Homem + acompanhante feminina");

  const handleNext = () => setStep(step + 1);
  const handleReset = () => {
    setStep(0);
  };

  const servicesList = [
    "Montagem de móveis",
    "Reparos em geral",
    "Legalização de projetos",
    "Regularização de obras",
    "Segurança do trabalho"
  ];

  const professionalsList = [
    "Profissional mulher",
    "Profissional homem",
    "Homem + acompanhante feminina"
  ];

  return (
    <Dialog onOpenChange={(open) => !open && handleReset()}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90">
          Iniciar Pagamento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pagamento Marido pra Quê?</DialogTitle>
          <DialogDescription>
            Configure seu atendimento e escolha a forma de pagamento.
          </DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="py-4 space-y-6">
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo de Serviço</Label>
              <RadioGroup value={service} onValueChange={setService} className="grid grid-cols-1 gap-2">
                {servicesList.map((s) => (
                  <div key={s} className="flex items-center space-x-3 rounded-lg border p-3 transition hover:bg-muted cursor-pointer">
                    <RadioGroupItem value={s} id={`s-${s}`} />
                    <Label htmlFor={`s-${s}`} className="text-sm font-medium cursor-pointer">{s}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Profissional</Label>
              <RadioGroup value={professional} onValueChange={setProfessional} className="grid grid-cols-1 gap-2">
                {professionalsList.map((p) => (
                  <div key={p} className="flex items-center space-x-3 rounded-lg border p-3 transition hover:bg-muted cursor-pointer">
                    <RadioGroupItem value={p} id={`p-${p}`} />
                    <Label htmlFor={`p-${p}`} className="text-sm font-medium cursor-pointer">{p}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Button className="w-full" onClick={handleNext}>
              Próximo: Pagamento <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="py-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground block mb-4">Forma de Pagamento</Label>
            <RadioGroup value={method} onValueChange={setMethod} className="gap-4">
              <div className="flex items-center space-x-3 rounded-xl border p-4 transition hover:bg-muted cursor-pointer">
                <RadioGroupItem value="pix" id="pix" />
                <Label htmlFor="pix" className="flex flex-1 items-center gap-3 cursor-pointer">
                  <QrCode className="h-5 w-5 text-brand" />
                  <div className="flex-1">
                    <p className="font-medium">Pix</p>
                    <p className="text-xs text-muted-foreground">Desconto de 5% • Instantâneo</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-xl border p-4 transition hover:bg-muted cursor-pointer">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex flex-1 items-center gap-3 cursor-pointer">
                  <CreditCard className="h-5 w-5 text-brand" />
                  <div className="flex-1">
                    <p className="font-medium">Cartão de Crédito</p>
                    <p className="text-xs text-muted-foreground">Até 10x sem juros</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-xl border p-4 transition hover:bg-muted cursor-pointer">
                <RadioGroupItem value="debit" id="debit" />
                <Label htmlFor="debit" className="flex flex-1 items-center gap-3 cursor-pointer">
                  <Wallet className="h-5 w-5 text-brand" />
                  <div className="flex-1">
                    <p className="font-medium">Débito / Presencial</p>
                    <p className="text-xs text-muted-foreground">Pagamento na maquininha</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
            <Button className="mt-6 w-full" onClick={handleNext}>
              Continuar para Resumo <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="py-4 space-y-6">
            <div className="rounded-xl bg-muted p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Serviço:</span>
                <span className="font-medium">{service}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profissional:</span>
                <span className="font-medium">{professional}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Método:</span>
                <span className="font-medium uppercase">{method}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg text-brand">
                <span>Total:</span>
                <span>{method === "pix" ? "R$ 142,50" : "R$ 150,00"}</span>
              </div>
            </div>
            
            {method === "pix" && (
              <div className="flex flex-col items-center gap-4 py-2">
                <div className="h-40 w-40 bg-white p-2 border rounded-lg">
                  <QrCode className="h-full w-full text-black" strokeWidth={1} />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Escaneie o código acima ou copie a chave Pix.
                </p>
                <Button variant="outline" size="sm" className="w-full">Copiar chave Pix</Button>
              </div>
            )}

            <Button className="w-full" onClick={handleNext}>
              {method === "pix" ? "Já realizei o pagamento" : "Confirmar e Pagar"}
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-brand/20 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-brand" />
            </div>
            <h3 className="text-xl font-bold">Pagamento Confirmado!</h3>
            <p className="text-sm text-muted-foreground">
              Seu serviço de <span className="font-semibold text-foreground">{service}</span> foi agendado com sucesso. Entraremos em contato em breve.
            </p>
            <div className="flex w-full gap-2 mt-4">
               <Button className="flex-1" onClick={() => window.location.href = "#"}>
                Voltar ao Início
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
