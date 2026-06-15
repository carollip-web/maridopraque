import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase
    .from("pagamento_splits")
    .select("id, orcamento_id, metadata, orcamentos(service_name)")
    .limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
