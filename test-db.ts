import { createClient } from "https://esm.sh/@supabase/supabase-js";
const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("VITE_SUPABASE_ANON_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const { data, error } = await supabase.from('profiles').select('*').limit(1);
console.log(data, error);
