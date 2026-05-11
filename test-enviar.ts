import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
  const { data: userAuth } = await supabase.auth.admin.getUserById('cb8e98da-d11e-4fc1-a9f7-640a2bb12efc'); // Need a real professional ID or just grab one from db
  
  const { data: user } = await supabase.from('profiles').select('*').limit(1).single();
  const userId = user.id;

  const { data: orc } = await supabase.from('orcamentos').insert({
      cliente_id: userId,
      service_name: 'Teste de Envio',
      status: 'customizado_pendente',
      profissional_id: userId,
  }).select().single();

  console.log('Orçamento inserido:', orc.id);

  const { data: row, error } = await supabase
      .from("orcamentos")
      .update({
        valor_servico: 200,
        observacoes_profissional: "Teste",
        profissional_id: userId,
        status: "enviado",
      })
      .eq("id", orc.id)
      .select()
      .single();
  
  if (error) {
    console.error('ERRO AO ENVIAR:', error);
  } else {
    console.log('SUCESSO:', row);
  }
}

test();
