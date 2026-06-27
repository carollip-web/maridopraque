// Envia push NATIVO (FCM HTTP v1) para os device_push_tokens de um usuário.
// Cobre Android agora; iOS passa a funcionar quando o app iOS for registrado no
// Firebase com a chave APNs (mesmo endpoint, o Firebase relaya para a Apple).
//
// Uso INTERNO: exige o service role key no Authorization. Requer o secret
// FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço do Firebase). Sem ele,
// vira no-op silencioso.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

// ---- helpers de OAuth2 (service account -> access token) ----
function b64url(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
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
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(toSign),
  );
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${SERVICE_KEY}`) return json({ error: "UNAUTHORIZED" }, 401);

  if (!FIREBASE_SA) return json({ ok: true, skipped: "fcm_not_configured", sent: 0 });

  let sa: { client_email: string; private_key: string; project_id: string };
  try {
    sa = JSON.parse(FIREBASE_SA);
  } catch {
    return json({ error: "BAD_SERVICE_ACCOUNT" }, 500);
  }

  const { user_id, title, body, link } = await req.json().catch(() => ({}));
  if (!user_id) return json({ error: "BAD_REQUEST", message: "user_id obrigatório" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: tokens, error } = await admin
    .from("device_push_tokens")
    .select("token")
    .eq("user_id", user_id);
  if (error) return json({ error: "DB_ERROR", message: error.message }, 500);
  if (!tokens || tokens.length === 0) return json({ ok: true, sent: 0 });

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e: any) {
    return json({ error: "OAUTH", message: e?.message }, 500);
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0;
  let removed = 0;

  for (const t of tokens) {
    const message = {
      message: {
        token: t.token,
        notification: { title: title || "Marido pra Quê?", body: body || "" },
        data: { link: link || "/" },
        android: { priority: "high", notification: { default_sound: true } },
        apns: { payload: { aps: { sound: "default" } } },
      },
    };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(message),
      });
      if (res.ok) {
        sent++;
      } else {
        const errBody = await res.json().catch(() => ({}));
        const status = errBody?.error?.status;
        // Token inválido/expirado → remove do banco.
        if (
          res.status === 404 ||
          status === "UNREGISTERED" ||
          status === "INVALID_ARGUMENT" ||
          status === "NOT_FOUND"
        ) {
          await admin.from("device_push_tokens").delete().eq("token", t.token);
          removed++;
        } else {
          console.error("[send-push-native] erro FCM", res.status, JSON.stringify(errBody));
        }
      }
    } catch (e: any) {
      console.error("[send-push-native] falha ao enviar", e?.message);
    }
  }

  return json({ ok: true, sent, removed });
});
