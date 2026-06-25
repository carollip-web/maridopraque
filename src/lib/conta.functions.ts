import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Exclui permanentemente a conta do usuário autenticado.
 * - Remove o usuário em auth.users (cascata apaga profile/dados ligados por FK).
 * - Bloqueia exclusão se o usuário for admin (precisa ser feito manualmente).
 */
export const excluirMinhaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Bloqueia admins por segurança
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roles?.some((r: { role: string }) => r.role === "admin")) {
      throw new Error(
        "Contas de administrador não podem ser excluídas por aqui. Contate o suporte.",
      );
    }

    // Bloqueia profissional com pedidos em andamento
    const { data: pendentes } = await supabase
      .from("orcamentos")
      .select("id, status")
      .or(`cliente_id.eq.${userId},profissional_id.eq.${userId}`)
      .in("status", ["aprovado", "pago"]);

    if (pendentes && pendentes.length > 0) {
      throw new Error(
        `Você tem ${pendentes.length} pedido(s) em andamento. Finalize ou cancele antes de excluir a conta.`,
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
