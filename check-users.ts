import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://xvrjzixmoitjbvzmmkdk.supabase.co";
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmp6aXhtb2l0amJ2em1ta2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzkzOTksImV4cCI6MjA5NDM1NTM5OX0.hN3BKwPBEt0Oia3b1vZ87tcdheqkJCBsag90PYJXqHA";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "admin-teste@example.com",
    password: "Teste@2026!",
  });
  console.log("Admin log in:", data.user ? "Success" : "Failed", error?.message);
}
main();
