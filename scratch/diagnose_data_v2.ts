
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rbfonmpuepqfhivvoqku.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZm9ubXB1ZXBxZmhpdnZvcWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTg1ODYsImV4cCI6MjA5MzU3NDU4Nn0._g2VD4-3LnaR6ab_23aIyg6mVGbZnBJ3OyAhTjSL0VY";

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
}

diagnose();
