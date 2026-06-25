import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminLevel } from "./admin-permissions.server";

const FROM = "Marido pra Quê <contato@maridopraque.com>";
const APP_URL = "https://www.maridopraque.com";

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

function renderConfirmEmail(nome: string, link: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.06)">
        <tr><td style="background:#FF6B35;padding:18px 24px;color:#fff;font-weight:700;font-size:16px">Marido pra Quê?</td></tr>
        <tr><td style="padding:28px 24px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">Confirme seu e-mail para continuar o cadastro</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#334155">
            Olá${nome ? ` ${nome}` : ""}, notamos que seu cadastro de prestador ficou pendente porque o e-mail ainda não foi confirmado.
            Clique no botão abaixo para confirmar seu e-mail e retomar o cadastro de onde parou.
          </p>
          <p style="margin:0 0 24px">
            <a href="${link}" style="display:inline-block;background:#FF6B35;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Confirmar meu e-mail</a>
          </p>
          <p style="margin:0;font-size:13px;color:#64748b">
            Se o botão não funcionar, copie e cole este link no navegador:<br/>
            <span style="word-break:break-all;color:#0f172a">${link}</span>
          </p>
        </td></tr>
        <tr><td style="padding:18px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
          Equipe Marido pra Quê — contato@maridopraque.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Returns a map of userId -> email_confirmed (boolean)
export const getEmailConfirmStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userIds: z.array(z.string().uuid()).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminLevel(supabase, userId, ["super_admin", "admin", "suporte"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result: Record<string, boolean> = {};
    // Iterate listUsers pages (cap: ~5 pages of 1000 = 5000 users) and filter
    const wanted = new Set(data.userIds);
    let page = 1;
    const perPage = 1000;
    while (page <= 10 && wanted.size > 0) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error || !list?.users?.length) break;
      for (const u of list.users) {
        if (wanted.has(u.id)) {
          result[u.id] = !!u.email_confirmed_at;
          wanted.delete(u.id);
        }
      }
      if (list.users.length < perPage) break;
      page += 1;
    }
    return { ok: true as const, confirmados: result };
  });

export const reenviarConfirmacaoEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminLevel(supabase, userId, ["super_admin", "admin", "suporte"]);

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAIL_API_KEY = process.env.GOOGLE_MAIL_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
      return { ok: false as const, error: "Gmail não configurado" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userResp, error: userErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userErr || !userResp?.user?.email) {
      return { ok: false as const, error: "Usuário não encontrado" };
    }
    const targetEmail = userResp.user.email;
    if (userResp.user.email_confirmed_at) {
      return { ok: false as const, error: "E-mail já foi confirmado" };
    }

    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("nome")
      .eq("id", data.userId)
      .maybeSingle();
    const nome = (profile?.nome || "").split(" ")[0] || "";

    // Generate a magic link — works for existing unconfirmed users and
    // confirms the email upon click. Redirects to the registration wizard.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: { redirectTo: `${APP_URL}/profissional-cadastro` },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return { ok: false as const, error: `Falha ao gerar link (${linkErr?.message || "desconhecido"})` };
    }
    const actionLink = linkData.properties.action_link;

    const subject = "Confirme seu e-mail — Marido pra Quê";
    const html = renderConfirmEmail(nome, actionLink);
    const raw = encodeRFC2822(targetEmail, subject, html);

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

    await (supabaseAdmin as any).from("email_send_log").insert({
      message_id: `admin-reenvio-confirm-${data.userId}-${Date.now()}`,
      template_name: "admin_reenvio_confirmacao",
      recipient_email: targetEmail,
      status,
      error_message: gwRes.ok ? null : gwBody.slice(0, 500),
      metadata: { sent_by: userId, subject, html },
    } as never);

    if (!gwRes.ok) {
      return { ok: false as const, error: `Falha no envio (${gwRes.status})` };
    }
    return { ok: true as const };
  });
