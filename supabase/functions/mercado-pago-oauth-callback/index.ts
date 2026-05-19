import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const code: string | undefined = body.code
    const state: string | undefined = body.state

    if (!code || !state) {
      return new Response(JSON.stringify({ error: "Parâmetros code e state são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const mpAppId = Deno.env.get("MERCADO_PAGO_APP_ID")
    const mpClientSecret = Deno.env.get("MERCADO_PAGO_CLIENT_SECRET")
    
    if (!mpAppId || !mpClientSecret) {
      console.error("Variáveis de ambiente do Mercado Pago não configuradas.")
      return new Response(JSON.stringify({ error: "Configuração do Mercado Pago ausente no servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const redirectUri = Deno.env.get("MERCADO_PAGO_REDIRECT_URI") ?? ""

    console.log("Exchanging Mercado Pago OAuth code for access token...")
    // Trocar o código de autorização pelo access_token do profissional
    const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "accept": "application/json",
      },
      body: new URLSearchParams({
        client_secret: mpClientSecret,
        client_id: mpAppId,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text()
      console.error("Erro ao obter token do Mercado Pago:", errBody)
      return new Response(JSON.stringify({ error: `Erro ao obter token do Mercado Pago: ${errBody}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in, user_id } = tokenData

    // Inicializar o cliente Supabase com a Service Role Key para bypassar RLS
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null

    console.log(`Atualizando perfil profissional do user ${state} com os dados do Mercado Pago...`)
    // Atualizar o perfil do profissional com os tokens e ID do Mercado Pago
    const { error: dbError } = await supabaseAdmin
      .from("profissional_perfil")
      .update({
        mp_user_id: String(user_id),
        mp_access_token: access_token,
        mp_refresh_token: refresh_token,
        mp_token_expires_at: expiresAt,
        mp_connected_at: new Date().toISOString(),
      })
      .eq("user_id", state)

    if (dbError) {
      console.error("Erro ao salvar tokens no banco de dados:", dbError)
      return new Response(JSON.stringify({ error: "Falha ao salvar tokens no banco de dados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Criar uma notificação informando que a conta foi vinculada
    await supabaseAdmin.from("notificacoes").insert({
      user_id: state,
      titulo: "Mercado Pago Conectado!",
      mensagem: "Sua conta do Mercado Pago foi vinculada com sucesso! Você já pode receber pagamentos com split de comissão.",
      link: "/profissional?tab=configuracoes",
      lida: false
    })

    return new Response(JSON.stringify({ ok: true, mp_user_id: user_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Erro não tratado no callback OAuth:", error)
    return new Response(JSON.stringify({ error: error.message || "Erro interno no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
