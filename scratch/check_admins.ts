
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAdmins() {
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('user_id, role, admin_level, profiles(email, nome)')
    .eq('role', 'admin')

  if (error) {
    console.error('Erro ao buscar admins:', error)
    return
  }

  console.log('--- Administradores Encontrados ---')
  roles?.forEach(r => {
    console.log(`User: ${r.profiles?.nome} (${r.profiles?.email})`)
    console.log(`Role: ${r.role} | Level: ${r.admin_level}`)
    console.log('-----------------------------------')
  })
}

checkAdmins()
