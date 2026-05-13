
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const emails = ['carol.lip@gmail.com', 'engenheirodonald@yahoo.com'];

async function promoteAdmins() {
  for (const email of emails) {
    console.log(`Verificando usuário: ${email}`);
    
    // 1. Buscar o ID do usuário pelo e-mail no profiles
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (pError || !profile) {
      console.error(`Usuário não encontrado no profiles: ${email}`, pError);
      continue;
    }

    const userId = profile.id;
    console.log(`ID encontrado: ${userId}. Promovendo...`);

    // 2. Tentar inserir ou atualizar na user_roles
    const { error: rError } = await supabase
      .from('user_roles')
      .upsert({ 
        user_id: userId, 
        role: 'admin', 
        admin_level: 'super_admin' 
      }, { onConflict: 'user_id,role' });

    if (rError) {
      console.error(`Erro ao promover ${email}:`, rError);
    } else {
      console.log(`Sucesso! ${email} agora é Super Admin.`);
    }
  }
}

promoteAdmins();
