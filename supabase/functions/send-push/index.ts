// Envia Web Push para todas as subscriptions de um usuário.
// Uso INTERNO: exige o service role key no Authorization (só código de servidor
// confiável chama). Requer os secrets VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e
// (opcional) VAPID_SUBJECT. Sem eles, vira no-op.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@maridopraque.com";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  // Só chamadas internas (que possuem o service role key) podem disparar push.
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${SERVICE_KEY}`) return json({ error: "UNAUTHORIZED" }, 401);

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ ok: true, skipped: "vapid_not_configured", sent: 0 });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const { user_id, title, body, link } = await req.json().catch(() => ({}));
  if (!user_id) return json({ error: "BAD_REQUEST", message: "user_id obrigatório" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user_id);
  if (error) return json({ error: "DB_ERROR", message: error.message }, 500);

  const payload = JSON.stringify({
    title: title || "Marido pra Quê?",
    body: body || "",
    link: link || "/",
  });

  let sent = 0;
  let removed = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (e: any) {
      // 404/410 = subscription expirada/cancelada → remove do banco.
      const code = e?.statusCode;
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        removed++;
      } else {
        console.error("[send-push] erro ao enviar", code, e?.body || e?.message);
      }
    }
  }

  return json({ ok: true, sent, removed });
});
