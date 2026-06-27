import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminLevel } from "./admin-permissions.server";

const registrarSchema = z.object({
  destinatario_user_id: z.string().uuid().nullable().optional(),
  destinatario_email: z.string().email().nullable().optional(),
  destinatario_telefone: z.string().trim().max(40).nullable().optional(),
  canal: z.enum(["whatsapp", "telefone", "outro"]).default("whatsapp"),
  assunto: z.string().trim().min(1).max(200),
  observacao: z.string().trim().max(2000).optional().nullable(),
});

export const registrarContatoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => registrarSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminLevel(supabase, userId, ["super_admin", "admin", "suporte"]);

    const { error } = await supabase.from("admin_contato_log").insert({
      admin_id: userId,
      destinatario_user_id: data.destinatario_user_id ?? null,
      destinatario_email: data.destinatario_email ?? null,
      destinatario_telefone: data.destinatario_telefone ?? null,
      canal: data.canal,
      assunto: data.assunto,
      observacao: data.observacao ?? null,
    } as never);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

const listarSchema = z.object({
  destinatario_user_id: z.string().uuid().nullable().optional(),
  destinatario_email: z.string().email().nullable().optional(),
});

export type ContatoHistoricoItem = {
  id: string;
  tipo: "email" | "whatsapp" | "telefone" | "outro";
  assunto: string;
  status: string | null;
  observacao: string | null;
  created_at: string;
  destinatario: string | null;
  admin_nome: string | null;
  html: string | null;
};

export const listarHistoricoContatos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => listarSchema.parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true; items: ContatoHistoricoItem[] } | { ok: false; error: string }> => {
    const { supabase, userId } = context;
    await requireAdminLevel(supabase, userId, ["super_admin", "admin", "suporte"]);

    const items: ContatoHistoricoItem[] = [];

    // E-mails: buscar por recipient_email
    if (data.destinatario_email) {
      const { data: emails, error: e1 } = await supabase
        .from("email_send_log")
        .select("id, message_id, template_name, recipient_email, status, error_message, metadata, created_at")
        .eq("recipient_email", data.destinatario_email)
        .order("created_at", { ascending: false })
        .limit(200);
      if (e1) return { ok: false, error: e1.message };

      // dedupe por message_id (último status)
      const seen = new Map<string, any>();
      for (const r of emails ?? []) {
        const key = r.message_id ?? r.id;
        const cur = seen.get(key);
        if (!cur || new Date(r.created_at) > new Date(cur.created_at)) seen.set(key, r);
      }
      for (const r of Array.from(seen.values())) {
        const md = (r.metadata ?? {}) as Record<string, unknown>;
        const assunto =
          (typeof md.subject === "string" && md.subject) ||
          (typeof md.assunto === "string" && md.assunto) ||
          r.template_name ||
          "(sem assunto)";
        items.push({
          id: r.id,
          tipo: "email",
          assunto: String(assunto),
          status: r.status,
          observacao: r.error_message ?? (typeof md.template_name === "string" ? `Template: ${md.template_name}` : null),
          created_at: r.created_at,
          destinatario: r.recipient_email,
          admin_nome: typeof md.sent_by_name === "string" ? md.sent_by_name : null,
          html: typeof md.html === "string" ? md.html : null,
        });
      }
    }

    // Contatos manuais (WhatsApp/telefone)
    let cq = supabase
      .from("admin_contato_log")
      .select("id, admin_id, destinatario_user_id, destinatario_email, destinatario_telefone, canal, assunto, observacao, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.destinatario_user_id) cq = cq.eq("destinatario_user_id", data.destinatario_user_id);
    else if (data.destinatario_email) cq = cq.eq("destinatario_email", data.destinatario_email);
    const { data: contatos, error: e2 } = await cq;
    if (e2) return { ok: false, error: e2.message };

    const adminIds = Array.from(new Set((contatos ?? []).map((c) => c.admin_id).filter(Boolean)));
    let adminMap: Record<string, string> = {};
    if (adminIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", adminIds);
      for (const p of profs ?? []) adminMap[p.id] = p.nome ?? "";
    }

    for (const c of contatos ?? []) {
      items.push({
        id: c.id,
        tipo: c.canal as "email" | "whatsapp" | "telefone" | "outro",
        assunto: c.assunto,
        status: "registrado",
        observacao: c.observacao,
        created_at: c.created_at,
        destinatario: c.destinatario_telefone ?? c.destinatario_email ?? null,
        admin_nome: adminMap[c.admin_id] ?? null,
        html: null,
      });
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { ok: true, items };
  });

const contagemSchema = z.object({
  emails: z.array(z.string().email()).max(500).default([]),
  user_ids: z.array(z.string().uuid()).max(500).default([]),
});

export const contarContatosLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => contagemSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminLevel(supabase, userId, ["super_admin", "admin", "suporte"]);

    const result: Record<string, { emails: number; whatsapp: number; ultimo: string | null }> = {};

    if (data.emails.length) {
      const { data: rows } = await supabase
        .from("email_send_log")
        .select("recipient_email, message_id, id, created_at")
        .in("recipient_email", data.emails);
      const byKey = new Map<string, Set<string>>();
      const lastByEmail = new Map<string, string>();
      for (const r of rows ?? []) {
        const email = r.recipient_email as string;
        const key = r.message_id ?? r.id;
        if (!byKey.has(email)) byKey.set(email, new Set());
        byKey.get(email)!.add(key);
        const prev = lastByEmail.get(email);
        if (!prev || r.created_at > prev) lastByEmail.set(email, r.created_at);
      }
      for (const email of data.emails) {
        result[email] = result[email] ?? { emails: 0, whatsapp: 0, ultimo: null };
        result[email].emails = byKey.get(email)?.size ?? 0;
        const u = lastByEmail.get(email) ?? null;
        if (u && (!result[email].ultimo || u > result[email].ultimo!)) result[email].ultimo = u;
      }
    }

    if (data.user_ids.length) {
      const { data: rows } = await supabase
        .from("admin_contato_log")
        .select("destinatario_user_id, destinatario_email, created_at")
        .in("destinatario_user_id", data.user_ids);
      // map user_id -> email para somar
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", data.user_ids);
      const emailById: Record<string, string> = {};
      for (const p of profs ?? []) emailById[p.id] = p.email ?? "";

      const countByUser = new Map<string, number>();
      const lastByUser = new Map<string, string>();
      for (const r of rows ?? []) {
        const uid = r.destinatario_user_id as string;
        countByUser.set(uid, (countByUser.get(uid) ?? 0) + 1);
        const prev = lastByUser.get(uid);
        if (!prev || r.created_at > prev) lastByUser.set(uid, r.created_at);
      }
      for (const uid of data.user_ids) {
        const email = emailById[uid] ?? "";
        const bucket = email && result[email] ? result[email] : { emails: 0, whatsapp: 0, ultimo: null as string | null };
        bucket.whatsapp = countByUser.get(uid) ?? 0;
        const u = lastByUser.get(uid) ?? null;
        if (u && (!bucket.ultimo || u > bucket.ultimo)) bucket.ultimo = u;
        if (email) result[email] = bucket;
        result[uid] = bucket;
      }
    }

    return { ok: true as const, counts: result };
  });
