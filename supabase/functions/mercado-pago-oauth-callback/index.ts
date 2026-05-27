import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, state } = await req.json()

    if (!code || !state) {
      return new Response(JSON.stringify({ error: 'Faltam parâmetros (code ou state).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: perfil } = await supabaseAdmin
      .from('profissional_perfil')
      .select('user_id, mp_oauth_state, mp_oauth_state_expires_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!perfil) {
      return new Response(JSON.stringify({ error: 'Perfil de profissional não encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (perfil.mp_oauth_state !== state) {
      return new Response(JSON.stringify({ error: 'State inválido.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!perfil.mp_oauth_state_expires_at || new Date(perfil.mp_oauth_state_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'State expirado, tente conectar novamente.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const MERCADO_PAGO_CLIENT_ID = Deno.env.get('MERCADO_PAGO_CLIENT_ID')
    const MERCADO_PAGO_CLIENT_SECRET = Deno.env.get('MERCADO_PAGO_CLIENT_SECRET')
    const MERCADO_PAGO_REDIRECT_URI = Deno.env.get('MERCADO_PAGO_REDIRECT_URI')

    if (!MERCADO_PAGO_CLIENT_ID || !MERCADO_PAGO_CLIENT_SECRET || !MERCADO_PAGO_REDIRECT_URI) {
      return new Response(JSON.stringify({ error: 'Configuração do Mercado Pago incompleta (faltam secrets).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const params = new URLSearchParams()
    params.append('grant_type', 'authorization_code')
    params.append('client_id', MERCADO_PAGO_CLIENT_ID)
    params.append('client_secret', MERCADO_PAGO_CLIENT_SECRET)
    params.append('code', code)
    params.append('redirect_uri', MERCADO_PAGO_REDIRECT_URI)

    const mpResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    })

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json()
      return new Response(JSON.stringify({ error: 'Falha ao conectar conta no Mercado Pago.', details: errorData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const tokenData = await mpResponse.json()
    const connectedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    const { error: updateError } = await supabaseAdmin
      .from('profissional_perfil')
      .update({
        mp_access_token: tokenData.access_token,
        mp_refresh_token: tokenData.refresh_token,
        mp_user_id: String(tokenData.user_id),
        mp_public_key: tokenData.public_key,
        mp_scope: tokenData.scope,
        mp_expires_at: expiresAt,
        mp_connected_at: connectedAt,
        mp_oauth_state: null,
        mp_oauth_state_expires_at: null,
      } as any)
      .eq('user_id', user.id)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Falha ao salvar tokens no perfil.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Apenas debug IDs, não vazar access_token
    console.log(`Mercado Pago conectado para user_id: ${user.id}, mp_user_id: ${tokenData.user_id}`)

    return new Response(JSON.stringify({ ok: true, connected_at: connectedAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
