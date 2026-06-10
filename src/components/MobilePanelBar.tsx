import React, { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

interface MobilePanelBarProps {
  /** Título exibido na barra superior (geralmente a seção ativa) */
  title: string;
  /** Subtítulo opcional ("Painel administrativo", etc.) */
  subtitle?: string;
  /** Conteúdo extra renderizado à direita do menu (notificações, status, etc.) */
  rightSlot?: React.ReactNode;
  /** Conteúdo do menu off-canvas (a sidebar) */
  children: React.ReactNode;
  /** Cor da barra. "dark" usa o esquema escuro do Admin */
  variant?: "light" | "dark";
  /** Quando true, esconde a barra mobile a partir do breakpoint informado.
   * Default = "md" (esconde a partir de md). Use "lg" pro painel do profissional. */
  hideFrom?: "md" | "lg";
}

/**
 * Barra superior fixa exibida apenas no mobile, com um botão "menu"
 * que abre uma Sheet off-canvas contendo a sidebar (children).
 */
export function MobilePanelBar({
  title,
  subtitle,
  rightSlot,
  children,
  variant = "light",
  hideFrom = "md",
}: MobilePanelBarProps) {
  const [open, setOpen] = useState(false);

  const hiddenClass = hideFrom === "lg" ? "lg:hidden" : "md:hidden";
  const isDark = variant === "dark";

  return (
    <>
      <div
        className={`${hiddenClass} sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b ${
          isDark
            ? "bg-[#0F172A] border-slate-800 text-white"
            : "bg-white/95 backdrop-blur border-border text-foreground"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className={`shrink-0 grid h-10 w-10 place-items-center rounded-xl transition ${
            isDark ? "hover:bg-slate-800" : "hover:bg-muted"
          }`}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          {subtitle && (
            <p
              className={`truncate text-[10px] uppercase tracking-widest font-semibold ${
                isDark ? "text-slate-400" : "text-muted-foreground"
              }`}
            >
              {subtitle}
            </p>
          )}
          <p className="truncate text-sm font-bold">{title}</p>
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className={`w-[85%] max-w-sm p-0 ${
            isDark ? "bg-[#0F172A] text-white border-slate-800" : ""
          }`}
        >
          <SheetHeader className="px-5 pt-5 pb-2 text-left">
            <SheetTitle className={isDark ? "text-white" : ""}>Menu</SheetTitle>
          </SheetHeader>
          <div
            className="flex flex-col h-[calc(100%-3.5rem)] overflow-y-auto"
            onClickCapture={(e) => {
              // Fecha o menu ao clicar em qualquer botão/link interno
              const target = e.target as HTMLElement;
              if (target.closest("button, a")) {
                setOpen(false);
              }
            }}
          >
            {children}
          </div>
          <SheetClose className="sr-only">Fechar</SheetClose>
        </SheetContent>
      </Sheet>
    </>
  );
}
