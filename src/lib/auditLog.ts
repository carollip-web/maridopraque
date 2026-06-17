import { SupabaseClient } from "@supabase/supabase-js";

export async function logAdminAction(
  supabase: SupabaseClient,
  {
    acao,
    detalhes,
    entidadeTipo,
    entidadeId,
  }: {
    acao: string;
    detalhes?: Record<string, any>;
    entidadeTipo?: string;
    entidadeId?: string;
  }
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.id) return;

    await supabase.from("admin_audit_log").insert({
      admin_id: userData.user.id,
      acao,
      detalhes,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
    });
  } catch (error) {
    console.error("Erro ao registrar log de auditoria:", error);
  }
}
