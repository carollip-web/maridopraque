import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://rbfonmpuepqfhivvoqku.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZm9ubXB1ZXBxZmhpdnZvcWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTg1ODYsImV4cCI6MjA5MzU3NDU4Nn0._g2VD4-3LnaR6ab_23aIyg6mVGbZnBJ3OyAhTjSL0VY");
async function run() {
  const { error } = await supabase.from("profiles").update({ avatar_url: 'test' }).eq('id', '123');
  console.log("Error:", error?.message || "Success");
}
run();
