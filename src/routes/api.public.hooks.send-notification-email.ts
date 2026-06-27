import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

function renderFallback(titulo: string, mensagem: string, link?: string | null) {
  const mensagemHtml = (mensagem ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  const cta = link
    ? `<table cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr><td style="border-radius:10px;background:#FF6B35;box-shadow:0 6px 16px -6px rgba(255,107,53,.55)">
        <a href="${APP_URL}${link}" style="display:inline-block;padding:13px 26px;color:#fff;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">Abrir no Marido pra Quê →</a>
      </td></tr></table>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent">${titulo} — ${mensagem.slice(0, 110)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f5f7;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="padding:0 4px 16px;font-size:13px;color:#64748b;letter-spacing:.3px">
          <span style="display:inline-block;width:22px;height:22px;background:#FF6B35;border-radius:6px;vertical-align:middle;margin-right:8px;line-height:22px;color:#fff;text-align:center;font-weight:700;font-size:12px">M</span>
          <strong style="color:#0f172a">Marido pra Quê?</strong> · serviços para a sua casa
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.04),0 12px 32px -16px rgba(15,23,42,.12);border:1px solid #eef0f3">
          <div style="height:4px;background:linear-gradient(90deg,#FF6B35 0%,#ff944d 60%,#ffb37a 100%)"></div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:36px 36px 28px">
            <div style="font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#FF6B35;margin-bottom:14px">Notificação</div>
            <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:700;color:#0f172a;letter-spacing:-.2px">${titulo}</h1>
            <p style="margin:0 0 24px;font-size:15.5px;line-height:1.6;color:#475569">${mensagemHtml}</p>
            ${cta}
          </td></tr></table>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:20px 36px;border-top:1px solid #eef0f3;background:#fafbfc">
            <p style="margin:0;font-size:12.5px;line-height:1.55;color:#64748b">
              Precisa de ajuda? Responda este e-mail ou fale com a gente em
              <a href="mailto:contato@maridopraque.com" style="color:#FF6B35;text-decoration:none;font-weight:500">contato@maridopraque.com</a>.
            </p>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:18px 8px 0;text-align:center;font-size:11.5px;line-height:1.6;color:#94a3b8">
          © ${new Date().getFullYear()} Marido pra Quê? · Você recebeu este e-mail porque tem uma conta na plataforma.<br/>
          <a href="${APP_URL}" style="color:#94a3b8;text-decoration:underline">maridopraque.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function applyVars(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v);
  return out.replace(/\{\{[^}]+\}\}/g, "");
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
          const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY);

          const { data: notif } = await admin
            .from("notificacoes")
            .select("id, user_id, titulo, mensagem, link, email_enviado")
            .eq("id", notification_id)
            .maybeSingle();

          if (!notif) return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 });

          // Dispara push (best-effort, independente do e-mail). Roda mesmo que o
          // usuário não tenha e-mail ou que o envio de e-mail seja pulado abaixo.
          const pushPayload = JSON.stringify({
            user_id: notif.user_id,
            title: notif.titulo,
            body: notif.mensagem,
            link: notif.link,
          });
          const pushHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
          };
          // Web Push (navegador/PWA)
          void fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: "POST",
            headers: pushHeaders,
            body: pushPayload,
          }).catch(() => {});
          // Push nativo (app Android/iOS via FCM)
          void fetch(`${SUPABASE_URL}/functions/v1/send-push-native`, {
            method: "POST",
            headers: pushHeaders,
            body: pushPayload,
          }).catch(() => {});

          if (notif.email_enviado) {
            return new Response(JSON.stringify({ ok: true, skipped: "already_sent" }), {
              status: 200,
            });
          }

          const { data: userData } = await admin.auth.admin.getUserById(notif.user_id);
          const email = userData?.user?.email;
          if (!email) {
            return new Response(JSON.stringify({ error: "NO_EMAIL" }), { status: 200 });
          }

          // Try DB template first; fall back to hardcoded layout.
          const { data: tpl } = await admin
            .from("email_templates")
            .select("assunto, html, ativo")
            .eq("slug", "notificacao")
            .maybeSingle();

          const cta = notif.link
            ? `<a href="${APP_URL}${notif.link}" style="display:inline-block;background:#FF6B35;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px;margin-top:18px">Abrir no Marido pra Quê</a>`
            : "";
          const vars = {
            titulo: notif.titulo ?? "",
            mensagem: notif.mensagem ?? "",
            link: notif.link ? `${APP_URL}${notif.link}` : "",
            app_url: APP_URL,
            cta,
          };
          const subject = tpl?.ativo ? applyVars(tpl.assunto, vars) : notif.titulo;
          const html = tpl?.ativo
            ? applyVars(tpl.html, vars)
            : renderFallback(notif.titulo, notif.mensagem, notif.link);
          const raw = encodeRFC2822(email, subject, html);

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
            metadata: { notification_id: notif.id, titulo: notif.titulo, html },
          });

          if (gwRes.ok) {
            await admin
              .from("notificacoes")
              .update({ email_enviado: true })
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
