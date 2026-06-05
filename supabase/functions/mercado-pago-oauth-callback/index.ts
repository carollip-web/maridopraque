// redeploy: 2026-06-05
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REDIRECT_URI_FIXO = "https://maridopraque.com/mercadopago/callback"

function maskCode(code: string | undefined | null): string {
  if (!code) return '(vazio)'
  return code.slice(0, 8) + '...(' + code.length + ' chars)'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, state } = await req.json()

    console.log('[oauth-callback] recebido', {
      code: maskCode(code),
      state: state ?? '(vazio)',
    })

    if (!code || !state) {
      console.error('[oauth-callback] parâmetros ausentes', { hasCode: !!code, hasState: !!state })
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
      console.error('[oauth-callback] usuário não autenticado')
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    console.log('[oauth-callback] usuário autenticado', { user_id: user.id })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('profissional_perfil')
      .select('user_id, mp_oauth_state, mp_oauth_state_expires_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (perfilError) {
      console.error('[oauth-callback] erro ao buscar perfil', perfilError)
    }

    if (!perfil) {
      console.error('[oauth-callback] perfil profissional não encontrado', { user_id: user.id })
      return new Response(JSON.stringify({ error: 'Perfil de profissional não encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (perfil.mp_oauth_state !== state) {
      console.error('[oauth-callback] state inválido', {
        recebido: state,
        salvo: perfil.mp_oauth_state,
      })
      return new Response(JSON.stringify({ error: 'State inválido.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!perfil.mp_oauth_state_expires_at || new Date(perfil.mp_oauth_state_expires_at) < new Date()) {
      console.error('[oauth-callback] state expirado', {
        expires_at: perfil.mp_oauth_state_expires_at,
      })
      return new Response(JSON.stringify({ error: 'State expirado, tente conectar novamente.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const MERCADO_PAGO_CLIENT_ID =
      Deno.env.get('MERCADO_PAGO_CLIENT_ID') || Deno.env.get('MERCADO_PAGO_APP_ID')
    const MERCADO_PAGO_CLIENT_SECRET = Deno.env.get('MERCADO_PAGO_CLIENT_SECRET')
    const MERCADO_PAGO_REDIRECT_URI =
      Deno.env.get('MP_REDIRECT_URI') || REDIRECT_URI_FIXO

    if (!MERCADO_PAGO_CLIENT_ID || !MERCADO_PAGO_CLIENT_SECRET || !MERCADO_PAGO_REDIRECT_URI) {
      console.error('[oauth-callback] configuração incompleta', {
        hasClientId: !!MERCADO_PAGO_CLIENT_ID,
        hasClientSecret: !!MERCADO_PAGO_CLIENT_SECRET,
        hasRedirectUri: !!MERCADO_PAGO_REDIRECT_URI,
      })
      return new Response(JSON.stringify({ error: 'Configuração do Mercado Pago incompleta (faltam secrets).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    console.log('[oauth-callback] trocando code por token', {
      client_id: MERCADO_PAGO_CLIENT_ID,
      redirect_uri: MERCADO_PAGO_REDIRECT_URI,
    })

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

    const mpRawText = await mpResponse.text()
    let mpParsed: any = null
    try {
      mpParsed = JSON.parse(mpRawText)
    } catch {
      mpParsed = { _raw: mpRawText }
    }

    if (!mpResponse.ok) {
      console.error('[oauth-callback] MP /oauth/token erro', {
        status: mpResponse.status,
        body: mpParsed,
      })
      return new Response(JSON.stringify({ error: 'Falha ao conectar conta no Mercado Pago.', details: mpParsed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    console.log('[oauth-callback] MP /oauth/token sucesso', {
      status: mpResponse.status,
      body: { ...mpParsed, access_token: '(omitido)', refresh_token: '(omitido)' },
    })

    const tokenData = mpParsed
    const connectedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    const { data: updateData, error: updateError } = await supabaseAdmin
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
      .select('user_id')

    console.log('[oauth-callback] update profissional_perfil', {
      data: updateData,
      error: updateError,
    })

    if (updateError) {
      console.error('[oauth-callback] falha ao salvar tokens', updateError)
      return new Response(JSON.stringify({ error: 'Falha ao salvar tokens no perfil.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    console.log('[oauth-callback] conexão concluída', {
      user_id: user.id,
      mp_user_id: tokenData.user_id,
    })

    return new Response(JSON.stringify({ ok: true, connected_at: connectedAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('[oauth-callback] exception', {
      message: error?.message,
      stack: error?.stack,
    })
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
