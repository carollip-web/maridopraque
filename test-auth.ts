import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

async function run() {
  const adminClient = createClient(supabaseUrl, supabaseKey);
  
  const { data: { session }, error: loginError } = await adminClient.auth.signInWithPassword({
    email: 'marcos@example.com', // Professional email?
    password: 'password123'      // Need to guess or find one
  });
  
  if (loginError) {
    console.error('LOGIN ERROR:', loginError.message);
    return;
  }
  
  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } }
  });
  
  console.log('Logged in as:', session.user.id);
  
  // Try finding an order
  const { data: orcs, error } = await userClient.from('orcamentos').select('*').limit(5);
  console.log('Orcamentos:', orcs, error);
}

run();
