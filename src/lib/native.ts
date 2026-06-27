// Integração com o shell nativo (Capacitor). Todo este módulo é no-op quando
// roda no navegador (web/PWA): só age quando o app está dentro do app nativo
// iOS/Android. Por isso pode ser chamado sempre, sem `if` espalhado pela UI.
//
// Importante: o app nativo carrega o site publicado (server.url), então este
// código vive no bundle web e é o que faz a ponte com os recursos nativos.

import { Capacitor } from "@capacitor/core";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function plataformaNativa(): "ios" | "android" | "web" {
  const p = Capacitor.getPlatform();
  return p === "ios" || p === "android" ? p : "web";
}

/**
 * Inicializa o comportamento nativo: esconde a splash, ajusta a status bar,
 * trata o botão "voltar" do Android e deep links. Seguro chamar no boot.
 */
export async function initNative(): Promise<void> {
  if (!isNative()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Fundo claro do app → ícones/texto escuros na status bar.
    await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  } catch (e) {
    console.warn("[native] status bar indisponível", e);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide().catch(() => {});
  } catch (e) {
    console.warn("[native] splash indisponível", e);
  }

  try {
    const { App } = await import("@capacitor/app");

    // Botão físico "voltar" (Android): volta no histórico ou sai do app na raiz.
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Deep links / Universal Links: abre o caminho recebido dentro do app.
    App.addListener("appUrlOpen", ({ url }) => {
      try {
        const parsed = new URL(url);
        const destino = parsed.pathname + parsed.search + parsed.hash;
        if (destino && destino !== "/") {
          window.location.href = destino;
        }
      } catch {
        // URL inesperada — ignora.
      }
    });
  } catch (e) {
    console.warn("[native] App plugin indisponível", e);
  }

  // Registro automático de push nativo quando o usuário está logado.
  await setupNativePushAutoRegister();
}

/**
 * Mantém o token de push do dispositivo registrado: ao abrir já logado e a cada
 * login, garante a permissão e salva o token. Só roda no app nativo.
 */
async function setupNativePushAutoRegister(): Promise<void> {
  if (!isNative()) return;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // Toque na notificação → abre a tela do link (deep link interno).
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const link = action.notification?.data?.link;
      if (link && typeof link === "string" && link !== "/") {
        window.location.href = link;
      }
    });

    const registrarSeLogado = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.id) await registrarPushNativo(data.user.id);
    };

    // Tenta na abertura (caso já esteja logado) e a cada novo login.
    await registrarSeLogado();
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        registrarPushNativo(session.user.id);
      }
    });
  } catch (e) {
    console.warn("[native] auto-registro de push falhou", e);
  }
}

/**
 * Registra o dispositivo para push NATIVO (APNs no iOS / FCM no Android) e
 * persiste o token no banco para a edge function de envio usar.
 *
 * TODO (Fase B): requer Firebase/FCM (Android) + chave APNs (iOS) configurados
 * e a tabela `device_push_tokens` + envio nativo no backend. Enquanto isso, não
 * é chamado automaticamente para não pedir permissão sem ter entrega por trás.
 */
export async function registrarPushNativo(userId: string): Promise<boolean> {
  if (!isNative() || !userId) return false;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { supabase } = await import("@/integrations/supabase/client");

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return false;

    return await new Promise<boolean>((resolve) => {
      PushNotifications.addListener("registration", async (token) => {
        const { error } = await (supabase as any).from("device_push_tokens").upsert(
          {
            user_id: userId,
            token: token.value,
            platform: plataformaNativa(),
          },
          { onConflict: "token" },
        );
        resolve(!error);
      });
      PushNotifications.addListener("registrationError", () => resolve(false));
      PushNotifications.register();
    });
  } catch (e) {
    console.warn("[native] push nativo falhou", e);
    return false;
  }
}
