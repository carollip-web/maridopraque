import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { requireAdminLevel, requireSuperAdmin } from "./admin-permissions.server";

const userSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["cliente", "profissional"]),
});

export const criarUsuarioAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => userSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // suporte é apenas leitura — só super_admin/admin criam usuários.
    await requireAdminLevel(supabase, userId, ["super_admin", "admin"]);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error(
        "Configuração do servidor ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no servidor.",
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Criar usuário no Auth
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });

    if (authError) throw new Error(`Erro no Auth: ${authError.message}`);
    if (!authUser.user) throw new Error("Usuário não retornado pelo Auth.");

    const newUserId = authUser.user.id;

    // 2. Atualizar perfil (profile)
    const { error: profileError } = await admin
      .from("profiles")
      .update({ nome: data.nome })
      .eq("id", newUserId);

    if (profileError) {
      console.warn("Erro ao atualizar nome no perfil, tentando inserir...", profileError);
      // Às vezes o trigger demora ou falha, tentamos upsert
      await admin.from("profiles").upsert({ id: newUserId, nome: data.nome, email: data.email });
    }

    // 3. Atribuir Role
    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });

    if (roleError) throw new Error(`Erro ao atribuir role: ${roleError.message}`);

    // 4. Se for profissional, criar perfil de profissional
    if (data.role === "profissional") {
      await admin.from("profissional_perfil").insert({ user_id: newUserId, ativo: true });
    }

    return { ok: true, userId: newUserId };
  });

const deleteUserSchema = z.object({
  targetUserId: z.string().uuid(),
});

export const excluirUsuarioAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Exclusão é destrutiva — apenas super_admin/admin podem.
    await requireAdminLevel(supabase, userId, ["super_admin", "admin"]);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error(
        "Configuração do servidor ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no servidor.",
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Remover do Auth (isso deve disparar os triggers de limpeza no DB, se existirem)
    // Se não existirem triggers ON DELETE CASCADE em todas as tabelas, precisamos limpar manualmente.

    // Limpeza manual preventiva para garantir integridade (especialmente tabelas que o CASCADE pode falhar)
    await admin.from("user_roles").delete().eq("user_id", data.targetUserId);
    await admin.from("profissional_perfil").delete().eq("user_id", data.targetUserId);

    // 2. Deletar o usuário no Auth
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.targetUserId);

    if (deleteError) {
      // Se der erro de FK, tentamos limpar profiles antes (embora auth.users seja o pai)
      await admin.from("profiles").delete().eq("id", data.targetUserId);
      const { error: retryError } = await admin.auth.admin.deleteUser(data.targetUserId);
      if (retryError) throw new Error(`Erro ao excluir usuário do Auth: ${retryError.message}`);
    }

    return { ok: true };
  });

const inviteSchema = z.object({
  email: z.string().email().max(255),
  admin_level: z.enum(["super_admin", "admin", "financeiro", "suporte"]),
  redirectTo: z.string().url().optional(),
});

export const convidarAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Apenas super_admin pode gerenciar a equipe administrativa.
    await requireSuperAdmin(supabase, userId);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error(
        "Configuração do servidor ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no servidor.",
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = data.email.trim().toLowerCase();

    // 1. Verifica se já existe conta para esse email
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    let targetUserId = existingProfile?.id as string | undefined;
    let invited = false;

    if (!targetUserId) {
      // 2. Convida via email — Supabase envia link mágico para o convidado definir senha
      const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: data.redirectTo,
      });
      if (inviteError) throw new Error(`Erro ao enviar convite: ${inviteError.message}`);
      if (!invite.user) throw new Error("Convite não retornou usuário.");
      targetUserId = invite.user.id;
      invited = true;

      // Garante perfil
      await admin.from("profiles").upsert({ id: targetUserId, email, nome: email.split("@")[0] });
    }

    // 3. Já é admin? Se sim, apenas atualiza nível
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id, admin_level")
      .eq("user_id", targetUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (existingRole) {
      if (existingRole.admin_level === data.admin_level) {
        return { ok: true, invited, alreadyAdmin: true, userId: targetUserId };
      }
      const { error: updErr } = await admin
        .from("user_roles")
        .update({ admin_level: data.admin_level })
        .eq("id", existingRole.id);
      if (updErr) throw new Error(`Erro ao atualizar nível: ${updErr.message}`);
      return { ok: true, invited, alreadyAdmin: true, userId: targetUserId };
    }

    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: targetUserId, role: "admin", admin_level: data.admin_level });
    if (roleError) throw new Error(`Erro ao atribuir papel: ${roleError.message}`);

    return { ok: true, invited, alreadyAdmin: false, userId: targetUserId };
  });

const updateEmailSchema = z.object({
  targetUserId: z.string().uuid(),
  newEmail: z.string().email(),
  forceReplace: z.boolean().optional(),
});

export const atualizarEmailAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateEmailSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Apenas super_admin pode alterar emails de outros admins via esta função
    await requireSuperAdmin(supabase, userId);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error(
        "Configuração do servidor ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no servidor.",
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (data.forceReplace) {
      try {
        const dummyEmail = `conflito_${Date.now()}_${data.newEmail}`;
        // Tenta achar o usuário conflitante no profile
        const { data: conflito } = await admin.from("profiles").select("id").ilike("email", data.newEmail).maybeSingle();
        if (conflito?.id && conflito.id !== data.targetUserId) {
          // Renomeia em vez de deletar para evitar erros de Foreign Key
          await admin.auth.admin.updateUserById(conflito.id, { email: dummyEmail, user_metadata: { email: dummyEmail } });
          await admin.from("profiles").update({ email: dummyEmail }).eq("id", conflito.id);
        } else {
          // Se não estiver no profile por algum motivo, busca na lista do auth
          const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
          const conflitoAuth = authList?.users?.find(u => u.email?.toLowerCase() === data.newEmail.toLowerCase());
          if (conflitoAuth?.id && conflitoAuth.id !== data.targetUserId) {
            await admin.auth.admin.updateUserById(conflitoAuth.id, { email: dummyEmail, user_metadata: { email: dummyEmail } });
          }
        }
      } catch (err) {
        console.warn("Erro ao tentar limpar conflito, continuando...", err);
      }
    }

    // Atualiza auth.users
    const { error: authError } = await admin.auth.admin.updateUserById(data.targetUserId, {
      email: data.newEmail,
      email_confirm: true,
      user_metadata: { email: data.newEmail },
    });
    if (authError) throw new Error(`Erro no Auth ao atualizar email: ${authError.message}`);

    // Atualiza profiles
    const { error: profileError } = await admin
      .from("profiles")
      .update({ email: data.newEmail })
      .eq("id", data.targetUserId);

    if (profileError) {
      console.warn("Falha ao atualizar profiles:", profileError);
    }

    return { ok: true };
  });
