import { Wrench, ArrowRight, Bell, User, CreditCard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

const WHATSAPP = "https://wa.me/5521999999999?text=Olá!%20Quero%20um%20orçamento.";

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

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
          <Link to="/porque" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold">Por que nós</Link>
          <Link to="/contato" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold">Contato</Link>
          <Link to="/login" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold">Entrar</Link>
        </nav>
        
        <div className="flex items-center gap-4">
          <Button asChild size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90 hidden lg:flex">
            <a href={WHATSAPP} target="_blank" rel="noreferrer">
              Orçamento <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>

          <div className="flex items-center gap-4 relative">
            <button 
              onClick={() => {
                 setShowNotifications(!showNotifications);
                 setShowProfileMenu(false);
              }}
              className="relative h-11 w-11 rounded-full border border-border bg-white flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-[10px] right-[10px] h-2.5 w-2.5 rounded-full bg-brand border-2 border-white box-content" />
            </button>
            
            <button 
              onClick={() => {
                 setShowProfileMenu(!showProfileMenu);
                 setShowNotifications(false);
              }}
              className="h-11 w-11 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-lg shadow-sm hover:bg-brand/20 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              C
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
               <div className="absolute top-14 right-14 w-80 bg-white rounded-2xl border border-border shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                     <h4 className="font-bold">Notificações</h4>
                     <button className="text-[10px] text-brand font-bold uppercase hover:underline">Marcar como lidas</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                     <div className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                        <p className="text-sm font-bold">Orçamento Aprovado</p>
                        <p className="text-xs text-muted-foreground mt-1">O profissional Ricardo M. aprovou seu orçamento para Pintura de Quarto.</p>
                        <p className="text-[10px] text-muted-foreground mt-2 font-bold">Há 2 horas</p>
                     </div>
                     <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer">
                        <p className="text-sm font-bold">Lembrete de Serviço</p>
                        <p className="text-xs text-muted-foreground mt-1">Seu serviço de Montagem de Guarda-roupa está agendado para amanhã às 10:00.</p>
                        <p className="text-[10px] text-muted-foreground mt-2 font-bold">Há 1 dia</p>
                     </div>
                  </div>
               </div>
            )}

            {/* Profile Dropdown */}
            {showProfileMenu && (
               <div className="absolute top-14 right-0 w-56 bg-white rounded-2xl border border-border shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                  <div className="p-4 border-b border-border bg-slate-50">
                     <p className="font-bold text-sm">Carolina L. Silva</p>
                     <p className="text-xs text-muted-foreground">carolina@email.com</p>
                  </div>
                  <div className="p-2">
                     <Link 
                       to="/cliente"
                       className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2"
                       onClick={() => setShowProfileMenu(false)}
                     >
                       <User className="h-4 w-4" /> Minha Conta
                     </Link>
                  </div>
                  <div className="p-2 border-t border-border">
                     <button className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2">
                       <LogOut className="h-4 w-4" /> Sair da conta
                     </button>
                  </div>
               </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
