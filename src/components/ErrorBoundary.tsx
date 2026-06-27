import { Component, type ReactNode } from "react";
import { reportError } from "@/lib/error-tracking";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Evita o "white screen of death": qualquer erro de render abaixo desta
// fronteira mostra um fallback amigável e registra o erro no tracking.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    reportError(error, {
      source: "ErrorBoundary",
      componentStack: info?.componentStack ?? undefined,
    });
  }

  handleReload = () => {
    this.setState({ hasError: false });
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-20">
        <div className="max-w-lg text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Ops</span>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Algo deu errado aqui.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Tivemos um problema inesperado ao carregar esta tela. Já registramos o erro. Você pode
            recarregar — seus dados estão a salvo.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-brand-foreground shadow-brand transition hover:-translate-y-0.5"
            >
              Recarregar a página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
