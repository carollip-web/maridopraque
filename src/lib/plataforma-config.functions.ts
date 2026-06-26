import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WhatsappTemplate = {
  id: string;
  titulo: string;
  mensagem: string;
};

export type PlataformaConfig = {
  marca_nome: string;
  marca_assinatura: string;
  whatsapp_templates: WhatsappTemplate[];
  updated_at?: string | null;
};

const DEFAULTS: PlataformaConfig = {
  marca_nome: "Marido pra Quê",
  marca_assinatura: "Equipe Marido pra Quê",
  whatsapp_templates: [],
};

export const getPlataformaConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlataformaConfig> => {
    const { data, error } = await context.supabase
      .from("plataforma_config")
      .select("marca_nome, marca_assinatura, whatsapp_templates, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULTS;
    return {
      marca_nome: data.marca_nome ?? DEFAULTS.marca_nome,
      marca_assinatura: data.marca_assinatura ?? DEFAULTS.marca_assinatura,
      whatsapp_templates: Array.isArray(data.whatsapp_templates)
        ? (data.whatsapp_templates as WhatsappTemplate[])
        : [],
      updated_at: data.updated_at,
    };
  });

export const updatePlataformaConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PlataformaConfig) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem alterar a configuração.");

    const marca_nome = (data.marca_nome || "").trim() || DEFAULTS.marca_nome;
    const marca_assinatura = (data.marca_assinatura || "").trim() || DEFAULTS.marca_assinatura;
    const templates = (data.whatsapp_templates || [])
      .filter((t) => t && (t.titulo || t.mensagem))
      .map((t) => ({
        id: (t.id || "").trim() || crypto.randomUUID(),
        titulo: (t.titulo || "").trim(),
        mensagem: (t.mensagem || "").trim(),
      }));

    const { error } = await context.supabase
      .from("plataforma_config")
      .upsert({
        id: 1,
        marca_nome,
        marca_assinatura,
        whatsapp_templates: templates,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
