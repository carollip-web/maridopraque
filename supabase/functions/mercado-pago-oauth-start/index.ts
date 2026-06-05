// redeploy: 2026-05-29
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

    // Opcional: Validar se é profissional
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'profissional')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Apenas profissionais podem conectar Mercado Pago.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const MERCADO_PAGO_CLIENT_ID =
      Deno.env.get('MERCADO_PAGO_CLIENT_ID') || Deno.env.get('MERCADO_PAGO_APP_ID')
    const MERCADO_PAGO_REDIRECT_URI = 'https://maridopraque.com/mp/callback'

    if (!MERCADO_PAGO_CLIENT_ID) {
      console.error('[mp-oauth-start] missing MERCADO_PAGO_CLIENT_ID')
      return new Response(JSON.stringify({ error: 'Configuração do Mercado Pago incompleta (falta MERCADO_PAGO_CLIENT_ID).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const state = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min

    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('profissional_perfil')
      .update({
        mp_oauth_state: state,
        mp_oauth_state_expires_at: expiresAt,
      } as any)
      .eq('user_id', user.id)
      .select('user_id')

    if (updateError || !updateResult || updateResult.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Perfil de profissional não encontrado. Complete seu cadastro antes de conectar o Mercado Pago.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const authUrl = `https://auth.mercadopago.com/authorization?client_id=${MERCADO_PAGO_CLIENT_ID}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(MERCADO_PAGO_REDIRECT_URI)}&state=${state}`

    return new Response(JSON.stringify({ authUrl }), {
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
