import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, QrCode, Wallet, CheckCircle2, ArrowRight } from "lucide-react";

export function PaymentSimulator() {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState("pix");

  const handleNext = () => setStep(step + 1);
  const handleReset = () => {
    setStep(1);
  };

  return (
    <Dialog onOpenChange={(open) => !open && handleReset()}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90">
          Iniciar Pagamento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pagamento Marido pra Quê?</DialogTitle>
          <DialogDescription>
            Escolha sua forma de pagamento preferida para finalizar o serviço.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="py-4">
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
                <span className="font-medium">Montagem de Móveis</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profissional:</span>
                <span className="font-medium">Acompanhante Feminina</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Método:</span>
                <span className="font-medium uppercase">{method}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg text-brand">
                <span>Total:</span>
                <span>R$ 150,00</span>
              </div>
            </div>
            
            {method === "pix" && (
              <div className="flex flex-col items-center gap-4 py-2">
                <div className="h-40 w-40 bg-white p-2 border rounded-lg">
                  {/* Placeholder for QR Code */}
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
              Seu serviço foi agendado e o pagamento recebido. Entraremos em contato em breve.
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
