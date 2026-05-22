import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xvrjzixmoitjbvzmmkdk.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY não definida. Tentando com anon key...");
}

const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmp6aXhtb2l0amJ2em1ta2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzkzOTksImV4cCI6MjA5NDM1NTM5OX0.hN3BKwPBEt0Oia3b1vZ87tcdheqkJCBsag90PYJXqHA";

const supabase = createClient(supabaseUrl, supabaseKey || anonKey);

async function main() {
  const { data, error } = await supabase
    .from("marketplace_integracoes")
    .select("provider, company_id, account_id, scope, token_expires_at, access_token, connected_at")
    .eq("provider", "btg");

  if (error) {
    console.error("Erro:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log("Nenhum registro encontrado para provider = btg");
    return;
  }

  // Format output like SQL result
  const rows = data.map((row) => ({
    provider: row.provider,
    company_id: row.company_id,
    account_id: row.account_id,
    scope: row.scope,
    token_expires_at: row.token_expires_at,
    tem_access_token: row.access_token !== null,
    connected_at: row.connected_at,
  }));

  console.table(rows);
}

main();
