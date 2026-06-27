// Envia push NATIVO para os device_push_tokens de um usuário.
//   - Android (e web nativo): FCM HTTP v1 (secret FIREBASE_SERVICE_ACCOUNT).
//   - iOS: APNs HTTP/2 direto (secrets APNS_AUTH_KEY, APNS_KEY_ID, APNS_TEAM_ID).
//
// Uso INTERNO: exige o service role key no Authorization. Cada plataforma é
// no-op se os respectivos secrets não estiverem configurados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// FCM (Android)
const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");

// APNs (iOS)
const APNS_AUTH_KEY = Deno.env.get("APNS_AUTH_KEY"); // conteúdo do .p8
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID");
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID");
const APNS_ENV = (Deno.env.get("APNS_ENV") || "sandbox").toLowerCase(); // sandbox | production
const APNS_BUNDLE_ID = "com.maridopraque.app";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

function b64url(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ---------- FCM (Android) ----------
async function getFcmAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const toSign = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign));
  const jwt = `${toSign}.${b64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("oauth: " + JSON.stringify(data));
  return data.access_token as string;
}

// ---------- APNs (iOS) ----------
async function getApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const payload = b64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }));
  const toSign = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(APNS_AUTH_KEY!),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(toSign),
  );
  return `${toSign}.${b64url(sig)}`;
}

async function sendApns(
  token: string,
  jwt: string,
  env: string,
  payload: string,
): Promise<Response> {
  const host = env === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  return await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
    },
    body: payload,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${SERVICE_KEY}`) return json({ error: "UNAUTHORIZED" }, 401);

  const { user_id, title, body, link } = await req.json().catch(() => ({}));
  if (!user_id) return json({ error: "BAD_REQUEST", message: "user_id obrigatório" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: tokens, error } = await admin
    .from("device_push_tokens")
    .select("token, platform")
    .eq("user_id", user_id);
  if (error) return json({ error: "DB_ERROR", message: error.message }, 500);
  if (!tokens || tokens.length === 0) return json({ ok: true, sent: 0 });

  const androidTokens = tokens.filter((t: any) => t.platform !== "ios");
  const iosTokens = tokens.filter((t: any) => t.platform === "ios");

  let sent = 0;
  let removed = 0;

  // ----- Android / web (FCM) -----
  if (androidTokens.length > 0 && FIREBASE_SA) {
    try {
      const sa = JSON.parse(FIREBASE_SA);
      const accessToken = await getFcmAccessToken(sa);
      const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
      for (const t of androidTokens) {
        const message = {
          message: {
            token: t.token,
            notification: { title: title || "Marido pra Quê?", body: body || "" },
            data: { link: link || "/" },
            android: { priority: "high", notification: { default_sound: true } },
          },
        };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(message),
        });
        if (res.ok) {
          sent++;
        } else {
          const errBody = await res.json().catch(() => ({}));
          const status = errBody?.error?.status;
          if (res.status === 404 || status === "UNREGISTERED" || status === "INVALID_ARGUMENT") {
            await admin.from("device_push_tokens").delete().eq("token", t.token);
            removed++;
          } else {
            console.error("[send-push-native] FCM erro", res.status, JSON.stringify(errBody));
          }
        }
      }
    } catch (e: any) {
      console.error("[send-push-native] FCM falhou", e?.message);
    }
  }

  // ----- iOS (APNs) -----
  if (iosTokens.length > 0 && APNS_AUTH_KEY && APNS_KEY_ID && APNS_TEAM_ID) {
    try {
      const jwt = await getApnsJwt();
      const apnsPayload = JSON.stringify({
        aps: { alert: { title: title || "Marido pra Quê?", body: body || "" }, sound: "default" },
        link: link || "/",
      });
      const fallbackEnv = APNS_ENV === "production" ? "sandbox" : "production";
      for (const t of iosTokens) {
        let res = await sendApns(t.token, jwt, APNS_ENV, apnsPayload);
        // Token de outro ambiente (dev x prod) → tenta o ambiente oposto.
        if (res.status === 400) {
          const reason = (await res.clone().json().catch(() => ({})))?.reason;
          if (reason === "BadDeviceToken") {
            res = await sendApns(t.token, jwt, fallbackEnv, apnsPayload);
          }
        }
        if (res.ok) {
          sent++;
        } else {
          const reason = (await res.json().catch(() => ({})))?.reason;
          if (res.status === 410 || reason === "Unregistered" || reason === "BadDeviceToken") {
            await admin.from("device_push_tokens").delete().eq("token", t.token);
            removed++;
          } else {
            console.error("[send-push-native] APNs erro", res.status, reason);
          }
        }
      }
    } catch (e: any) {
      console.error("[send-push-native] APNs falhou", e?.message);
    }
  }

  return json({ ok: true, sent, removed });
});
