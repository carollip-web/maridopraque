// Fundação de error tracking para produção.
//
// Hoje registra os erros de forma estruturada (visível no console do browser e
// nos logs de SSR) e, se um SDK compatível com Sentry estiver presente em
// `window.Sentry`, encaminha para ele. Assim dá para plugar o Sentry depois —
// via script/CDN + DSN — sem precisar adicionar dependência ao build.

interface SentryLike {
  captureException: (error: unknown, context?: { extra?: Record<string, unknown> }) => void;
}

declare global {
  interface Window {
    Sentry?: SentryLike;
  }
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  // Encaminha para o Sentry, se disponível. Nunca deixa o próprio tracking
  // derrubar a aplicação.
  try {
    if (typeof window !== "undefined" && window.Sentry?.captureException) {
      window.Sentry.captureException(error, context ? { extra: context } : undefined);
    }
  } catch {
    // ignore
  }

  const payload = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  };
  console.error("[app-error]", payload);
}

let initialized = false;

// Instala os handlers globais de erro (uma única vez, só no browser).
export function initErrorTracking() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, { source: "window.onerror" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { source: "unhandledrejection" });
  });
}
