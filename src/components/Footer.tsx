import { Wrench, MessageCircle } from "lucide-react";

const WHATSAPP = "https://wa.me/5511999999999?text=Olá!%20Quero%20um%20orçamento.";

export function Footer() {
  return (
    <>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
              <Wrench className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium text-foreground">Marido pra Quê?</span>
          </div>
          <p>© {new Date().getFullYear()} — Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-soft transition hover:scale-105"
      >
        <MessageCircle className="h-5 w-5" />
      </a>
    </>
  );
}
