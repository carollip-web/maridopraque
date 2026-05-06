import { Wrench, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

const WHATSAPP = "https://wa.me/5521999999999?text=Olá!%20Quero%20um%20orçamento.";

export function Footer() {
  return (
    <>
      <footer className="sticky bottom-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-6 text-sm text-muted-foreground md:flex-row">
          <div className="flex flex-col items-center gap-4 md:items-start">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
                <Wrench className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium text-foreground">Marido pra Quê?</span>
            </div>
            <p className="max-w-[240px] text-center text-xs leading-relaxed md:text-left">
              Soluções inteligentes em reparos e obras para o Rio de Janeiro.
            </p>
          </div>
          
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4 font-medium text-foreground">
            <Link to="/servicos" className="transition hover:text-brand">Serviços</Link>
            <Link to="/profissionais" className="transition hover:text-brand">Equipe</Link>
            <Link to="/pagamento" className="transition hover:text-brand">Pagamento</Link>
            <Link to="/ajuda" className="transition hover:text-brand">Central de Ajuda</Link>
            <Link to="/contato" className="transition hover:text-brand">Contato</Link>
            <Link to="/admin" className="text-[10px] opacity-20 transition hover:opacity-100">Admin</Link>
          </nav>

          <div className="flex flex-col items-center gap-2 md:items-end">
             <p>© {new Date().getFullYear()} — Todos os direitos reservados.</p>
             <p className="text-[10px] uppercase tracking-widest opacity-50">Feito com ❤️ no RJ</p>
          </div>
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
