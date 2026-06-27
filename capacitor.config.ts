import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuração do app nativo (iOS + Android) via Capacitor.
 *
 * Estratégia: o app é um shell nativo que carrega o site já publicado
 * (TanStack Start + SSR) pela `server.url`, somada a recursos nativos
 * (push, câmera, splash, status bar). Assim reaproveitamos 100% do app web
 * sem manter um segundo código.
 *
 * Para builds de homologação apontando para um ambiente local/preview, use a
 * variável CAP_SERVER_URL ao rodar `npx cap sync` (ex.: para o preview do
 * Lovable). Sem ela, usa a produção.
 */
const SERVER_URL = process.env.CAP_SERVER_URL || "https://maridopraque.lovable.app";

const config: CapacitorConfig = {
  appId: "com.maridopraque.app",
  appName: "Marido pra Quê?",
  // webDir é obrigatório; serve como fallback offline empacotado no app.
  webDir: "mobile/www",
  server: {
    url: SERVER_URL,
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#FF6B35",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
