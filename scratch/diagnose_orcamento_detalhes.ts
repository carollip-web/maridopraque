import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
  console.log("--- Diagnosing Recent Budgets ---");
  const { data: orcamentos, error: orcError } = await supabase
    .from("orcamentos")
    .select(
      "id, service_name, status, tipo_atendimento, data_preferida, periodo_preferido, horario_preferido, flexibilidade_agenda, profissional_id",
    )
    .order("created_at", { ascending: false })
    .limit(5);

  if (orcError) {
    console.error("Error fetching orcamentos:", orcError);
    return;
  }

  console.table(orcamentos);

  for (const o of orcamentos) {
    const { data: blocks, error: blockError } = await supabase
      .from("profissional_bloqueios_agenda")
      .select("*")
      .eq("orcamento_id", o.id);

    if (blockError) {
      console.error(`Error fetching blocks for orcamento ${o.id}:`, blockError);
    } else if (blocks && blocks.length > 0) {
      console.log(`Blocks for orcamento ${o.id}:`);
      console.table(blocks);
    } else {
      console.log(`No blocks found for orcamento ${o.id}`);
    }
  }
}

diagnose();
