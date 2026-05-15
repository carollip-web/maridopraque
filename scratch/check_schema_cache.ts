
const supabaseUrl = "https://rbfonmpuepqfhivvoqku.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZm9ubXB1ZXBxZmhpdnZvcWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTg1ODYsImV4cCI6MjA5MzU3NDU4Nn0._g2VD4-3LnaR6ab_23aIyg6mVGbZnBJ3OyAhTjSL0VY";

async function checkSchema() {
  console.log("--- FETCHING POSTGREST SCHEMA DEFINITION ---");
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const schema = await res.json();
    const orcamentos = schema.definitions.orcamentos;
    if (orcamentos) {
      const props = orcamentos.properties;
      const columns = [
        'data_preferida',
        'periodo_preferido',
        'horario_preferido',
        'flexibilidade_agenda',
        'tipo_atendimento'
      ];
      columns.forEach(col => {
        if (props[col]) {
          console.log(`Column '${col}' EXISTS in schema cache.`);
        } else {
          console.log(`Column '${col}' MISSING from schema cache!`);
        }
      });
    } else {
      console.log("Definition for 'orcamentos' not found in schema.");
    }
  } catch (err) {
    console.error("Error fetching schema:", err);
  }
}

checkSchema();
