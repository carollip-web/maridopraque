import { Wrench, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

const WHATSAPP = "https://wa.me/5521999999999?text=Olá!%20Quero%20falar%20com%20a%20equipe.";

export function Footer() {
  return (
    <>
      <footer className="border-t border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-foreground text-background">
              <Wrench className="h-3 w-3" />
            </span>
            <span className="font-medium text-foreground">Marido pra Quê?</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] font-medium text-foreground">
            <Link to="/servicos" className="transition hover:text-brand">
              Serviços
            </Link>
            <Link to="/profissionais" className="transition hover:text-brand">
              Equipe
            </Link>
            <Link to="/pagamento" className="transition hover:text-brand">
              Pagamento
            </Link>
            <Link to="/ajuda" className="transition hover:text-brand">
              Ajuda
            </Link>
            <Link to="/contato" className="transition hover:text-brand">
              Contato
            </Link>
            <Link to="/termos" className="transition hover:text-brand">
              Termos
            </Link>
            <Link to="/privacidade" className="transition hover:text-brand">
              Privacidade
            </Link>
            <Link to="/cancelamento" className="transition hover:text-brand">
              Cancelamento
            </Link>
          </nav>

          <p className="text-[11px]">© {new Date().getFullYear()} — Marido pra Quê?</p>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar no WhatsApp"
        className="group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-brand transition-all duration-300 hover:scale-110 hover:shadow-[0_24px_60px_-20px_oklch(0.5_0.13_30/0.6)] active:scale-95"
      >
        <span className="absolute inset-0 rounded-full bg-brand/40 animate-ping opacity-60 group-hover:opacity-0" />
        <MessageCircle className="relative h-6 w-6" />
      </a>
    </>
  );
}
