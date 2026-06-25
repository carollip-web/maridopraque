import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminLevel } from "./admin-permissions.server";

const FROM = "Marido pra Quê <contato@maridopraque.com>";
const APP_URL = "https://maridopraque.lovable.app";

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
  return btoa(unescape(encodeURIComponent(headers + "\r\n" + body)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function applyVars(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v);
  return out.replace(/\{\{[^}]+\}\}/g, "");
}

function renderFallback(subject: string, mensagem: string) {
  const safeMsg = escapeHtml(mensagem).replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.06)">
        <tr><td style="background:#FF6B35;padding:18px 24px;color:#fff;font-weight:700;font-size:16px">Marido pra Quê?</td></tr>
        <tr><td style="padding:28px 24px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(subject)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#334155">${safeMsg}</p>
        </td></tr>
        <tr><td style="padding:18px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
          Equipe Marido pra Quê — contato@maridopraque.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const schema = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

export const enviarEmailAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminLevel(supabase, userId, ["super_admin", "admin", "suporte"]);

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAIL_API_KEY = process.env.GOOGLE_MAIL_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
      return { ok: false as const, error: "Gmail não configurado" };
    }

    // Look up DB template (admin_contato); fallback to hardcoded layout.
    const { supabaseAdmin: adminClient } = await import("@/integrations/supabase/client.server");
    const { data: tpl } = await (adminClient as any)
      .from("email_templates")
      .select("assunto, html, ativo")
      .eq("slug", "admin_contato")
      .maybeSingle();
    const vars = {
      assunto: data.subject,
      nome: data.to.split("@")[0],
      mensagem: escapeHtml(data.message).replace(/\n/g, "<br/>"),
      app_url: APP_URL,
    };
    const subject = tpl?.ativo ? applyVars(tpl.assunto, vars) : data.subject;
    const html = tpl?.ativo ? applyVars(tpl.html, vars) : renderFallback(data.subject, data.message);
    const raw = encodeRFC2822(data.to, subject, html);

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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_send_log").insert({
      message_id: `admin-${userId}-${Date.now()}`,
      template_name: "admin_manual",
      recipient_email: data.to,
      status,
      error_message: gwRes.ok ? null : gwBody.slice(0, 500),
      metadata: { sent_by: userId, subject: data.subject },
    } as never);

    if (!gwRes.ok) {
      return { ok: false as const, error: `Falha no envio (${gwRes.status})` };
    }
    return { ok: true as const };
  });
