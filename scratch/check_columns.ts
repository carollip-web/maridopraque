
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://rbfonmpuepqfhivvoqku.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZm9ubXB1ZXBxZmhpdnZvcWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTg1ODYsImV4cCI6MjA5MzU3NDU4Nn0._g2VD4-3LnaR6ab_23aIyg6mVGbZnBJ3OyAhTjSL0VY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log("--- CHECKING ORCAMENTOS COLUMNS ---");
  const { data, error } = await supabase
    .from('orcamentos')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error("Error fetching orcamentos:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log("Columns found:", Object.keys(data[0]));
  } else {
    console.log("No data found to check columns, trying to fetch one row without filters...");
    const { data: allData, error: allErr } = await supabase.from('orcamentos').select('*').limit(1);
    if (allData && allData.length > 0) {
        console.log("Columns found (unfiltered):", Object.keys(allData[0]));
    } else {
        console.log("Table is empty. Cannot determine columns via SELECT *.");
    }
  }
}

checkColumns();
