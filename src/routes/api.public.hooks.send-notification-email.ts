import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const APP_URL = "https://maridopraque.lovable.app";
const FROM = "Marido pra Quê <contato@maridopraque.com>";

function encodeRFC2822(to: string, subject: string, html: string): string {
  const boundary = "----=_MaridoBoundary_" + Math.random().toString(36).slice(2);
  const headers = [
    `From: ${FROM}`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join("\r\n");
  const body = [
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const msg = headers + "\r\n" + body;
  // base64url
  return btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function renderHtml(titulo: string, mensagem: string, link?: string | null) {
  const cta = link
    ? `<a href="${APP_URL}${link}" style="display:inline-block;background:#FF6B35;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px;margin-top:18px">Abrir no Marido pra Quê</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.06)">
        <tr><td style="background:#FF6B35;padding:18px 24px;color:#fff;font-weight:700;font-size:16px">Marido pra Quê?</td></tr>
        <tr><td style="padding:28px 24px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${titulo}</h1>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#334155">${mensagem}</p>
          ${cta}
        </td></tr>
        <tr><td style="padding:18px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
          Você está recebendo este e-mail porque tem uma conta no Marido pra Quê.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export const Route = createFileRoute("/api/public/hooks/send-notification-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { notification_id } = (await request.json().catch(() => ({}))) as {
            notification_id?: string;
          };
          if (!notification_id) {
            return new Response(JSON.stringify({ error: "BAD_REQUEST" }), { status: 400 });
          }

          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          const admin = createClient(SUPABASE_URL, SERVICE_KEY);

          const { data: notif } = await admin
            .from("notificacoes")
            .select("id, user_id, titulo, mensagem, link, email_enviado")
            .eq("id", notification_id)
            .maybeSingle();

          if (!notif) return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 });
          if ((notif as any).email_enviado) {
            return new Response(JSON.stringify({ ok: true, skipped: "already_sent" }), {
              status: 200,
            });
          }

          const { data: userData } = await admin.auth.admin.getUserById(notif.user_id);
          const email = userData?.user?.email;
          if (!email) {
            return new Response(JSON.stringify({ error: "NO_EMAIL" }), { status: 200 });
          }

          const html = renderHtml(notif.titulo, notif.mensagem, notif.link);
          const raw = encodeRFC2822(email, notif.titulo, html);

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY!;
          const GOOGLE_MAIL_API_KEY = process.env.GOOGLE_MAIL_API_KEY!;

          const gwRes = await fetch(
            "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
              },
              body: JSON.stringify({ raw }),
            },
          );

          const gwBody = await gwRes.text();
          const status = gwRes.ok ? "sent" : "failed";

          await admin.from("email_send_log").insert({
            message_id: notif.id,
            template_name: "notificacao",
            recipient_email: email,
            status,
            error_message: gwRes.ok ? null : gwBody.slice(0, 500),
            metadata: { notification_id: notif.id, titulo: notif.titulo },
          } as any);

          if (gwRes.ok) {
            await admin
              .from("notificacoes")
              .update({ email_enviado: true } as any)
              .eq("id", notif.id);
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          }

          return new Response(JSON.stringify({ error: "GATEWAY", details: gwBody }), {
            status: 502,
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: "INTERNAL", message: e?.message }), {
            status: 500,
          });
        }
      },
    },
  },
});
