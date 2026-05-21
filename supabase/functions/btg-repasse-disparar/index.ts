import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Utility para formatar a chave PIX (telefone exige +55 no começo, segundo a API BTG)
function formatPixKey(key: string, keyType: string): string {
  let formattedKey = key.trim()
  if (keyType === 'TELEFONE' || keyType === 'PHONE') {
    const numbersOnly = formattedKey.replace(/\D/g, '')
    if (numbersOnly.length === 11 || numbersOnly.length === 10) {
      formattedKey = `+55${numbersOnly}`
    } else if (numbersOnly.length === 13 && numbersOnly.startsWith('55')) {
      formattedKey = `+${numbersOnly}`
    } else if (!formattedKey.startsWith('+')) {
       formattedKey = `+${numbersOnly}`
    }
  }
  return formattedKey
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

    // 1. Obter usuário autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 2. Valida que o usuário é admin com nível elevado (super_admin ou financeiro)
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("admin_level")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .in("admin_level", ["super_admin", "financeiro"])
      .maybeSingle()

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores com nível elevado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 3. Receber parâmetros
    const { repasse_ids } = await req.json()
    if (!repasse_ids || !Array.isArray(repasse_ids) || repasse_ids.length === 0) {
      return new Response(JSON.stringify({ error: "repasse_ids não fornecido ou vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Usar um service_role client para contornar RLS ao atualizar e buscar dados de integrações
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // 4. Buscar credenciais BTG
    const { data: btgConfig, error: btgError } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("access_token, company_id, account_id, token_expires_at, scope")
      .eq("provider", "btg")
      .maybeSingle()

    if (btgError || !btgConfig || !btgConfig.access_token) {
      return new Response(JSON.stringify({ error: "Integração BTG não encontrada ou não autenticada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!btgConfig.company_id || !btgConfig.account_id) {
      return new Response(JSON.stringify({ error: "Integração BTG conectada, mas conta/empresa ainda não configurada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const tokenExpired = btgConfig.token_expires_at ? new Date(btgConfig.token_expires_at) <= new Date() : true
    const hasScope = typeof btgConfig.scope === 'string' && btgConfig.scope.includes("brn:btg:empresas:banking:payments")

    // Log seguro inicial
    console.log("Iniciando repasses PIX:", {
      provider: "btg",
      hasAccountId: !!btgConfig.account_id,
      hasCompanyId: !!btgConfig.company_id,
      hasScopeBankingPayments: hasScope,
      tokenExpired
    })

    if (tokenExpired || !hasScope) {
      return new Response(JSON.stringify({ error: "Token BTG sem permissão de pagamento ou expirado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const results = []

    // 5. Processar cada repasse
    for (const repasseId of repasse_ids) {
      try {
        const { data: repasse, error: repError } = await supabaseAdmin
          .from("repasses_profissionais")
          .select("*")
          .eq("id", repasseId)
          .eq("status", "aprovado")
          .maybeSingle()

        if (repError || !repasse) {
          results.push({ id: repasseId, success: false, error: "Repasse não encontrado ou não está no status 'aprovado'." })
          continue
        }

        if (!repasse.pix_key || !repasse.pix_holder_document || !repasse.pix_holder_name) {
          results.push({ id: repasseId, success: false, error: "Dados de PIX incompletos." })
          continue
        }

        const btgPayload = {
          items: [
            {
              type: "PIX_KEY",
              amount: Number(repasse.valor_liquido),
              paymentDate: todayStr,
              description: "Repasse de serviços",
              debitParty: {
                branchCode: "50",
                number: btgConfig.account_id
              },
              detail: {
                key: {
                  value: formatPixKey(repasse.pix_key, repasse.pix_key_type || '')
                },
                creditParty: {
                  name: repasse.pix_holder_name,
                  taxId: repasse.pix_holder_document.replace(/\D/g, '') // Documento apenas números
                }
              },
              tags: {
                externalId: repasse.id
              }
            }
          ]
        }

        // De acordo com a API Reference: url_base/{companyId}/banking/payments
        const btgRequestUrl = `https://api.sandbox.empresas.btgpactual.com/${btgConfig.company_id}/banking/payments`

        const btgResponse = await fetch(btgRequestUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${btgConfig.access_token}`,
            "Content-Type": "application/json",
            "x-idempotency-key": repasse.id
          },
          body: JSON.stringify(btgPayload)
        })

        const responseText = await btgResponse.text()
        let responseJson = null
        try {
          if (responseText) responseJson = JSON.parse(responseText)
        } catch (e) {
          responseJson = { rawText: responseText }
        }

        console.log("BTG API call result:", {
          endpoint: btgRequestUrl,
          status: btgResponse.status,
          response: responseJson
        })

        if (!btgResponse.ok) {
          let errorMessage = JSON.stringify(responseJson).substring(0, 1000)
          let clearError = responseJson
          
          if (btgResponse.status === 401 || btgResponse.status === 403) {
            const msg = "Token BTG sem permissão de pagamento ou expirado."
            errorMessage = msg
            clearError = msg
          }

          console.error(`Erro no BTG repasse ${repasse.id}:`, responseText)
          await supabaseAdmin
            .from("repasses_profissionais")
            .update({
              status: "falhou",
              erro: errorMessage,
              btg_request_payload: btgPayload,
              btg_response_payload: responseJson,
              failed_at: new Date().toISOString()
            })
            .eq("id", repasse.id)

          results.push({ id: repasseId, success: false, error: clearError })
        } else {
          // Sucesso (201 Created)
          const batchId = responseJson?.batchId || null

          await supabaseAdmin
            .from("repasses_profissionais")
            .update({
              status: "processando",
              btg_transfer_id: batchId,
              btg_request_payload: btgPayload,
              btg_response_payload: responseJson,
              processing_at: new Date().toISOString()
            })
            .eq("id", repasse.id)

          results.push({ id: repasseId, success: true, batchId })
        }
      } catch (err: any) {
        console.error(`Erro interno ao processar repasse ${repasseId}:`, err)
        results.push({ id: repasseId, success: false, error: err.message })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error: any) {
    console.error("Erro fatal na edge function:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
