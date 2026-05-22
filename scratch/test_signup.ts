import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://xvrjzixmoitjbvzmmkdk.supabase.co";
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmp6aXhtb2l0amJ2em1ta2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzkzOTksImV4cCI6MjA5NDM1NTM5OX0.hN3BKwPBEt0Oia3b1vZ87tcdheqkJCBsag90PYJXqHA";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignup() {
  const email = "cli1@maridopraque.com.br";
  console.log(`Tentando criar usuário ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: "Teste@2026!",
    options: {
      data: {
        nome: "Cliente de Teste",
      },
    },
  });
  if (error) {
    console.error("Erro no signUp:", error.message);
  } else {
    console.log(
      "Sessão presente? (Confirmação de e-mail pode estar ativada se for null):",
      !!data.session,
    );
  }

  // Vamos tentar dar login
  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email,
    password: "Teste@2026!",
  });

  if (loginErr) {
    console.error("Erro no login logo após criar:", loginErr.message);
  } else {
    console.log("Login bem-sucedido:", loginData.user.email);
  }
}

testSignup();
