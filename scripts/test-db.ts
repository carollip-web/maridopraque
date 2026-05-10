import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

async function run() {
  const fakeId = uuidv4();
  const { data, error } = await supabase.from("profiles").insert({
    id: fakeId,
    nome: "Teste Falso"
  }).select();
  
  console.log("Profiles Insert Error:", error);
  if (!error) {
     console.log("Success! No FK constraint on auth.users.");
     await supabase.from("profiles").delete().eq("id", fakeId);
  }
}

run();
