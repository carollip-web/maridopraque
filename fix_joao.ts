import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  console.log('Buscando perfis...');
  const { data: profs } = await supabase.from('profiles').select('id, nome').ilike('nome', '%Joao%');
  console.log('Perfis encontrados:', profs);

  if (profs && profs.length > 0) {
    const joaoId = profs[0].id;
    console.log('Buscando pedidos onde Joao é cliente...');
    const { data: orcs } = await supabase.from('orcamentos').select('id, profissional_id').eq('cliente_id', joaoId);
    console.log('Pedidos encontrados:', orcs?.length);

    if (orcs && orcs.length > 0) {
      // Find a real client to swap
      const { data: realClients } = await supabase.from('user_roles').select('user_id').eq('role', 'cliente').limit(1);
      if (realClients && realClients.length > 0) {
        const realClientId = realClients[0].user_id;
        console.log('Trocando cliente_id para:', realClientId);
        for (const o of orcs) {
          await supabase.from('orcamentos').update({ cliente_id: realClientId }).eq('id', o.id);
        }
        console.log('Sucesso! Registros corrigidos.');
      }
    }
  }
}

fix();
