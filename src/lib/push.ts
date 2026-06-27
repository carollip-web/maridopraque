// Push notifications (Web Push) no cliente: registra o service worker,
// assina o PushManager com a chave VAPID pública e persiste a subscription
// no banco para a edge function de envio usar depois.
//
// Tudo é gated: se VITE_VAPID_PUBLIC_KEY não estiver configurada, as funções
// viram no-op silencioso (o app segue funcionando sem push).

import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function pushSuportado(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushConfigurado(): boolean {
  return !!VAPID_PUBLIC_KEY;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSuportado()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.warn("[push] falha ao registrar service worker", e);
    return null;
  }
}

function subscriptionToRow(sub: PushSubscription, userId: string) {
  const json = sub.toJSON();
  return {
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };
}

/**
 * Garante a subscription de push do usuário e a salva no banco.
 * Pré-condições: suporte do navegador, permissão concedida e VAPID configurada.
 * Retorna true se há subscription ativa persistida.
 */
export async function ativarPush(userId: string): Promise<boolean> {
  if (!pushSuportado() || !pushConfigurado()) return false;
  if (typeof Notification !== "undefined" && Notification.permission !== "granted") return false;

  const reg = await registrarServiceWorker();
  if (!reg) return false;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    });
  }

  // push_subscriptions ainda não está nos tipos gerados do Supabase — cast pontual.
  const { error } = await (supabase as any)
    .from("push_subscriptions")
    .upsert(subscriptionToRow(sub, userId), { onConflict: "endpoint" });
  if (error) {
    console.warn("[push] falha ao salvar subscription", error.message);
    return false;
  }
  return true;
}

/** Remove a subscription do dispositivo atual (banco + navegador). */
export async function desativarPush(): Promise<void> {
  if (!pushSuportado()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) {
    console.warn("[push] falha ao desativar push", e);
  }
}
