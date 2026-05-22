import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xvrjzixmoitjbvzmmkdk.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmp6aXhtb2l0amJ2em1ta2RrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc3OTM5OSwiZXhwIjoyMDk0MzU1Mzk5fQ.fMhF2l9DW_KzMvo7-j4WC_Sea3KnSS_gM85XSTo_CD8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function setAdmin() {
  const userId = "67294914-1012-4b3a-861a-fb9d79072565"; // carol.lip@gmail.com

  const { data, error } = await supabase.from("user_roles").insert({
    user_id: userId,
    role: "admin",
    admin_level: "super_admin",
  });

  console.log("Insert result:", data, error?.message || "Success");
}
setAdmin();
