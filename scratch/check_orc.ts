import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkOrcamento() {
  const id = "a04c4a84-cbbc-490f-a410-ed11b50cff8e";
  const { data, error } = await supabase.from("orcamentos").select("*").eq("id", id).single();

  if (error) {
    console.error("Erro ao buscar:", error);
  } else {
    console.log("Dados do Orçamento:", {
      id: data.id,
      cliente_id: data.cliente_id,
      status: data.status,
      created_at: data.created_at,
    });
  }
}

checkOrcamento();
