import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-20">
      <div className="max-w-lg text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Erro 404
        </span>
        <h1 className="mt-4 text-balance text-5xl font-semibold tracking-tight md:text-6xl">
          Essa página tirou folga.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          O link pode ter mudado, mas o seu reparo a gente resolve. Peça um orçamento
          em menos de 2 minutos ou volte para o início.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/servicos"
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-brand-foreground shadow-brand transition hover:-translate-y-0.5"
          >
            Pedir orçamento agora
          </Link>
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-7 text-sm font-medium text-foreground transition hover:bg-brand-soft"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Marido pra Quê? — Reparos, Montagem e Regularização" },
      { name: "description", content: "Profissionais verificados para montagem de móveis, reparos elétricos, hidráulica e legalização de obras. Orçamento online em 2 minutos." },
      { name: "author", content: "Marido pra Quê?" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Marido pra Quê?" },
      { property: "og:title", content: "Marido pra Quê? — Reparos e Montagens" },
      { property: "og:description", content: "Profissionais verificados, orçamento online e opção com acompanhante feminina." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Marido pra Quê? — Reparos e Montagens" },
      { name: "twitter:description", content: "Profissionais verificados, orçamento online e opção com acompanhante feminina." },
      { name: "theme-color", content: "#FF6B35" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Marido pra Quê" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <Toaster richColors position="top-right" />
      </div>
    </QueryClientProvider>
  );
}
