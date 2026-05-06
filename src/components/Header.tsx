import { Wrench, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

const WHATSAPP = "https://wa.me/5521999999999?text=Olá!%20Quero%20um%20orçamento.";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
            <Wrench className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Marido pra Quê<span className="text-brand">?</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm md:flex">
          <Link to="/servicos" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold">Serviços</Link>
          <Link to="/profissionais" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold">Profissionais</Link>
          <Link to="/pagamento" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold">Pagamento</Link>
          <Link to="/porque" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold">Por que nós</Link>
          <Link to="/contato" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold">Contato</Link>
        </nav>
        <Button asChild size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90">
          <a href={WHATSAPP} target="_blank" rel="noreferrer">
            Orçamento <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </header>
  );
}
