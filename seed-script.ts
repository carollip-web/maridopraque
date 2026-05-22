import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://xvrjzixmoitjbvzmmkdk.supabase.co";
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmp6aXhtb2l0amJ2em1ta2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzkzOTksImV4cCI6MjA5NDM1NTM5OX0.hN3BKwPBEt0Oia3b1vZ87tcdheqkJCBsag90PYJXqHA";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Calling seed-test-data...");
  const { data, error } = await supabase.functions.invoke("seed-test-data", {
    method: "POST",
  });
  if (error) {
    console.error("Error calling seed-test-data:", error);
  } else {
    console.log("Success:", data);
  }
}
main();
