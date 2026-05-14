
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rbfonmpuepqfhivvoqku.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZm9ubXB1ZXBxZmhpdnZvcWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTg1ODYsImV4cCI6MjA5MzU3NDU4Nn0._g2VD4-3LnaR6ab_23aIyg6mVGbZnBJ3OyAhTjSL0VY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("--- PROPOSALS ---");
  const { data: propostas, error } = await supabase
    .from("propostas")
    .select("id, orcamento_id, profissional_id, status, valor_servico, created_at")
    .order('created_at', {ascending: false})
    .limit(10);
    
  if (error) console.error(error);
  console.log(JSON.stringify(propostas, null, 2));

  if (propostas && propostas.length > 0) {
      const orcIds = propostas.map(p => p.orcamento_id);
      console.log(`\n--- BUDGET STATUSES FOR PROPOSALS ---`);
      // This might still fail due to has_role in policy, but worth a try with specific IDs
      const { data: orcs, error: e2 } = await supabase
        .from("orcamentos")
        .select("id, service_name, status, cliente_id, profissional_id")
        .in("id", orcIds);
      if (e2) console.error(e2);
      console.log(JSON.stringify(orcs, null, 2));
  }
}

diagnose();
