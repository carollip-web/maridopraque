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
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function applyVars(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v);
  return out.replace(/\{\{[^}]+\}\}/g, "");
}

function renderFallback(subject: string, mensagemHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.06)">
        <tr><td style="background:#FF6B35;padding:18px 24px;color:#fff;font-weight:700;font-size:16px">Marido pra Quê?</td></tr>
        <tr><td style="padding:28px 24px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(subject)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#334155">${mensagemHtml}</p>
        </td></tr>
        <tr><td style="padding:18px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
          Equipe Marido pra Quê — contato@maridopraque.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const recipientSchema = z.object({
  email: z.string().email(),
  nome: z.string().optional().default(""),
  etapa: z.string().optional().default(""),
  campos_faltantes: z.string().optional().default(""),
});

const schema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(20000),
  recipients: z.array(recipientSchema).min(1).max(500),
  template_slug: z.string().trim().min(1).max(80).optional(),
});

export const enviarEmailMassaAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminLevel(supabase, userId, ["super_admin", "admin", "suporte"]);

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAIL_API_KEY = process.env.GOOGLE_MAIL_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
      return { ok: false as const, error: "Gmail não configurado", sent: 0, failed: 0 };
    }

    const { supabaseAdmin: adminClient } = await import("@/integrations/supabase/client.server");
    const { data: tpl } = await adminClient
      .from("email_templates")
      .select("assunto, html, ativo")
      .eq("slug", data.template_slug || "admin_contato")
      .maybeSingle();

    const batchId = `bulk-${userId}-${Date.now()}`;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < data.recipients.length; i++) {
      const r = data.recipients[i];
      const vars = {
        assunto: data.subject,
        nome: r.nome || r.email.split("@")[0],
        etapa: r.etapa || "",
        campos_faltantes: r.campos_faltantes || "",
        mensagem: applyVars(data.message, {
          nome: r.nome || r.email.split("@")[0],
          etapa: r.etapa || "",
          campos_faltantes: r.campos_faltantes || "",
        })
          .split("\n")
          .map((l) => escapeHtml(l))
          .join("<br/>"),
        app_url: APP_URL,
      };
      const subject = tpl?.ativo ? applyVars(tpl.assunto, vars) : applyVars(data.subject, vars);
      const html = tpl?.ativo ? applyVars(tpl.html, vars) : renderFallback(subject, vars.mensagem);
      const raw = encodeRFC2822(r.email, subject, html);

      try {
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
        if (gwRes.ok) sent++;
        else failed++;

        await adminClient.from("email_send_log").insert({
          message_id: `${batchId}-${i}`,
          template_name: "admin_bulk",
          recipient_email: r.email,
          status,
          error_message: gwRes.ok ? null : gwBody.slice(0, 500),
          metadata: { sent_by: userId, subject: data.subject, batch_id: batchId, index: i, html },
        } as never);
      } catch (e: any) {
        failed++;
        await adminClient.from("email_send_log").insert({
          message_id: `${batchId}-${i}`,
          template_name: "admin_bulk",
          recipient_email: r.email,
          status: "failed",
          error_message: String(e?.message || e).slice(0, 500),
          metadata: { sent_by: userId, subject: data.subject, batch_id: batchId, index: i, html },
        } as never);
      }

      // throttle ~1.5/s to respect Gmail quota
      if (i < data.recipients.length - 1) await new Promise((r) => setTimeout(r, 700));
    }

    return { ok: true as const, sent, failed, batch_id: batchId };
  });
