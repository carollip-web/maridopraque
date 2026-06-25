import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Buscar mensagens não lidas, não notificadas, de 3h atrás (limit 50 destinatários)
  // Como o Supabase não permite group by direto via PostgREST de forma simples com selects complexos, 
  // vamos buscar as mensagens e agrupar em memória, limitando.
  
  // Calcula o timestamp de 3 horas atrás
  const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data: mensagens, error: msgError } = await supabase
    .from("mensagens")
    .select("id, remetente_id, destinatario_id, texto, created_at")
    .eq("lida", false)
    .neq("notificada_email", true)
    .lt("created_at", tresHorasAtras)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("Erro ao buscar mensagens:", msgError);
    return new Response(JSON.stringify({ error: msgError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!mensagens || mensagens.length === 0) {
    return new Response(JSON.stringify({ ok: true, notificados: 0, falhas: 0, message: "Nenhuma mensagem pendente" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Agrupar por destinatário
  const agrupadas = mensagens.reduce((acc, msg) => {
    if (!acc[msg.destinatario_id]) {
      acc[msg.destinatario_id] = [];
    }
    acc[msg.destinatario_id].push(msg);
    return acc;
  }, {} as Record<string, typeof mensagens>);

  const destinatariosIds = Object.keys(agrupadas).slice(0, 50);
  
  let notificados = 0;
  let falhas = 0;

  for (const destId of destinatariosIds) {
    try {
      const msgs = agrupadas[destId];
      const msgIds = msgs.map(m => m.id);
      
      // Obter email do destinatário
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(destId);
      if (userError || !userData?.user?.email) {
        console.error(`Erro ao obter email para destinatário ${destId}:`, userError);
        falhas++;
        continue;
      }
      
      const emailDestinatario = userData.user.email;

      // Obter remetente principal (pegar o primeiro)
      const primeiroRemetente = msgs[0].remetente_id;
      const { data: profileData } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", primeiroRemetente)
        .maybeSingle();
      
      const nomeRemetente = profileData?.nome || "Um usuário";
      
      // Enviar via Gmail connector gateway
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const GMAIL_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
      if (LOVABLE_API_KEY && GMAIL_KEY) {
        const subject = `Você tem ${msgs.length} mensagem(ns) não lida(s) de ${nomeRemetente}`;
        const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;background:#fff;border-radius:12px"><h2 style="color:#FF6B35">Marido pra Quê?</h2><p>${nomeRemetente} te enviou ${msgs.length} mensagem(ns) que você ainda não leu.</p><a href="https://maridopraque.lovable.app" style="display:inline-block;background:#FF6B35;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">Abrir conversa</a></div>`;
        const headers = [
          "From: Marido pra Quê <contato@maridopraque.com>",
          `To: ${emailDestinatario}`,
          `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
          "MIME-Version: 1.0",
          'Content-Type: text/html; charset="UTF-8"',
          "",
          html,
        ].join("\r\n");
        const raw = btoa(unescape(encodeURIComponent(headers))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const gw = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GMAIL_KEY },
          body: JSON.stringify({ raw }),
        });
        if (!gw.ok) console.error("Falha Gmail:", await gw.text());
      } else {
        console.log(`[EMAIL] Gmail connector não configurado para ${emailDestinatario}`);
      }
      // Simulação de sucesso
      
      // Atualizar mensagens para não notificar de novo
      const { error: updateError } = await supabase
        .from("mensagens")
        .update({ notificada_email: true })
        .in("id", msgIds);
        
      if (updateError) {
        console.error(`Erro ao atualizar mensagens como notificadas para ${destId}:`, updateError);
        falhas++;
      } else {
        notificados++;
      }
      
    } catch (e) {
      console.error(`Exceção ao processar destinatário ${destId}:`, e);
      falhas++;
    }
  }

  return new Response(JSON.stringify({ ok: true, notificados, falhas }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
