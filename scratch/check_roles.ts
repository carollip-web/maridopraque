import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xvrjzixmoitjbvzmmkdk.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmp6aXhtb2l0amJ2em1ta2RrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc3OTM5OSwiZXhwIjoyMDk0MzU1Mzk5fQ.fMhF2l9DW_KzMvo7-j4WC_Sea3KnSS_gM85XSTo_CD8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: users } = await supabase.auth.admin.listUsers();

  const { data: roles } = await supabase.from("user_roles").select("*");

  console.log(
    "Users:",
    users?.users?.map((u) => ({ id: u.id, email: u.email })),
  );
  console.log("Roles:", roles);
}
check();
