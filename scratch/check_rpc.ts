
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rbfonmpuepqfhivvoqku.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZm9ubXB1ZXBxZmhpdnZvcWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTg1ODYsImV4cCI6MjA5MzU3NDU4Nn0._g2VD4-3LnaR6ab_23aIyg6mVGbZnBJ3OyAhTjSL0VY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
  console.log("--- CHECKING RPC PRESENCE ---");
  // Try calling it with a fake ID to see the error message
  const { data, error } = await supabase.rpc('marcar_orcamento_enviado', { _orcamento_id: '00000000-0000-0000-0000-000000000000' });
  
  if (error) {
    console.log("Error from RPC call:", error);
    if (error.message.includes("function") && error.message.includes("does not exist")) {
      console.log("RESULT: RPC DOES NOT EXIST IN DB.");
    } else if (error.code === "42501") {
       console.log("RESULT: RPC EXISTS BUT PERMISSION DENIED (Expected for anon).");
    } else {
       console.log("RESULT: RPC EXISTS (returned other error).");
    }
  } else {
    console.log("RESULT: RPC EXISTS AND RETURNED SUCCESS (Unexpected for fake ID).", data);
  }
}

checkRpc();
