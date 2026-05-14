
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("--- BUDGETS ---");
  const { data: orcamentos } = await supabase.from("orcamentos").select("id, service_name, status, cliente_id, profissional_id").order('created_at', {ascending: false}).limit(10);
  console.log(JSON.stringify(orcamentos, null, 2));

  console.log("\n--- PROPOSALS ---");
  const { data: propostas } = await supabase.from("propostas").select("*").order('created_at', {ascending: false}).limit(10);
  console.log(JSON.stringify(propostas, null, 2));

  console.log("\n--- PROFISSIONAL PERFIL ---");
  const { data: perfis } = await supabase.from("profissional_perfil").select("*").limit(5);
  console.log(JSON.stringify(perfis, null, 2));
  
  console.log("\n--- USER ROLES ---");
  const { data: roles } = await supabase.from("user_roles").select("*").limit(10);
  console.log(JSON.stringify(roles, null, 2));
}

diagnose();
