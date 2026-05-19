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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    )

    // Obter o usuário autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Obter o App ID do Mercado Pago
    const mpAppId = Deno.env.get("MERCADO_PAGO_APP_ID")
    if (!mpAppId) {
      throw new Error("MERCADO_PAGO_APP_ID não está configurado nas Secrets do Supabase.")
    }

    const redirectUri = Deno.env.get("MERCADO_PAGO_REDIRECT_URI") ?? ""
    if (!redirectUri) {
      throw new Error("MERCADO_PAGO_REDIRECT_URI não está configurado.")
    }

    // Construir a URL de autorização do Mercado Pago
    // O parâmetro state carrega o ID do profissional para podermos identificá-lo no retorno
    const authUrl = `https://auth.mercadopago.com/authorization?client_id=${mpAppId}&response_type=code&platform_id=mp&state=${user.id}&redirect_uri=${encodeURIComponent(redirectUri)}`

    return new Response(JSON.stringify({ url: authUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
