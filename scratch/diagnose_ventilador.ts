
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rbfonmpuepqfhivvoqku.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZm9ubXB1ZXBxZmhpdnZvcWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTg1ODYsImV4cCI6MjA5MzU3NDU4Nn0._g2VD4-3LnaR6ab_23aIyg6mVGbZnBJ3OyAhTjSL0VY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("--- LATEST BUDGETS (Instalação de ventilador teto) ---");
  const { data: orcamentos, error: e1 } = await supabase
    .from("orcamentos")
    .select("id, service_name, status, cliente_id, profissional_id, valor, valor_servico, created_at, updated_at")
    .ilike('service_name', '%ventilador%')
    .order('created_at', {ascending: false})
    .limit(5);
    
  if (e1) console.error("Error orcamentos:", e1);
  console.log(JSON.stringify(orcamentos, null, 2));

  if (orcamentos && orcamentos.length > 0) {
    const targetId = orcamentos[0].id;
    console.log(`\n--- PROPOSALS FOR BUDGET ${targetId} ---`);
    const { data: propostas, error: e2 } = await supabase
      .from("propostas")
      .select("*")
      .eq('orcamento_id', targetId);
    if (e2) console.error("Error propostas:", e2);
    console.log(JSON.stringify(propostas, null, 2));
    
    if (propostas && propostas.length > 0) {
       const profId = propostas[0].profissional_id;
       console.log(`\n--- PROFESSIONAL PROFILE ${profId} ---`);
       const { data: perfil, error: e3 } = await supabase
         .from("profissional_perfil")
         .select("*")
         .eq("user_id", profId)
         .maybeSingle();
       if (e3) console.error("Error perfil:", e3);
       console.log(JSON.stringify(perfil, null, 2));
    }
  }

  console.log("\n--- ALL PROFESSIONAL PERFILES (Top 5) ---");
  const { data: perfis } = await supabase.from("profissional_perfil").select("*").limit(5);
  console.log(JSON.stringify(perfis, null, 2));
}

diagnose();
