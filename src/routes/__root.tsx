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
            to="/orcamentos"
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
      { title: "Lovable App" },
      { name: "description", content: "Marido Pra Quê? connects users with skilled professionals for furniture assembly and home repairs." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Marido Pra Quê? connects users with skilled professionals for furniture assembly and home repairs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "Marido Pra Quê? connects users with skilled professionals for furniture assembly and home repairs." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/247003ec-e96d-4373-9827-4a89e62bedaf/id-preview-c57de0f2--ec1fc676-bf03-4dd3-84db-f84467056948.lovable.app-1778009054186.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/247003ec-e96d-4373-9827-4a89e62bedaf/id-preview-c57de0f2--ec1fc676-bf03-4dd3-84db-f84467056948.lovable.app-1778009054186.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
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

function RootComponent() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toaster richColors position="top-right" />
    </div>
  );
}
