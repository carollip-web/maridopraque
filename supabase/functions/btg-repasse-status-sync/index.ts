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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // 3. Buscar repasses pendentes ("processando", "aguardando_aprovacao_btg")
    const { data: repasses, error: repassesError } = await supabaseAdmin
      .from("repasses_profissionais")
      .select("id, btg_transfer_id, status")
      .in("status", ["processando", "aguardando_aprovacao_btg"])
      .not("btg_transfer_id", "is", null)

    if (repassesError) {
      return new Response(JSON.stringify({ error: "Erro ao buscar repasses." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!repasses || repasses.length === 0) {
      return new Response(JSON.stringify({ results: [], message: "Nenhum repasse pendente de sincronização." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    // 4. Buscar credenciais BTG
    const { data: btgConfig, error: btgError } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("access_token, company_id, token_expires_at, scope")
      .eq("provider", "btg")
      .maybeSingle()

    if (btgError || !btgConfig || !btgConfig.access_token) {
      return new Response(JSON.stringify({ error: "Integração BTG não encontrada ou não autenticada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const tokenExpired = btgConfig.token_expires_at ? new Date(btgConfig.token_expires_at) <= new Date() : true
    const hasScope = typeof btgConfig.scope === 'string' && 
                    (btgConfig.scope.includes("brn:btg:empresas:banking:payments") || 
                     btgConfig.scope.includes("brn:btg:empresas:banking:payments.readonly"))

    if (tokenExpired || !hasScope) {
      return new Response(JSON.stringify({ error: "Token BTG sem permissão de consulta ou expirado. Reconecte o BTG." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const results = []

    // 5. Consultar cada lote no BTG
    for (const repasse of repasses) {
      try {
        const batchId = repasse.btg_transfer_id
        const btgRequestUrl = `https://api.sandbox.empresas.btgpactual.com/${btgConfig.company_id}/banking/payments?batchId=${batchId}&pageSize=10&pageNumber=1`

        const btgResponse = await fetch(btgRequestUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${btgConfig.access_token}`
          }
        })

        const responseText = await btgResponse.text()
        let responseJson = null
        try {
          if (responseText) responseJson = JSON.parse(responseText)
        } catch (e) {
          responseJson = { rawText: responseText }
        }

        if (!btgResponse.ok) {
          console.error(`Erro ao consultar status repasse ${repasse.id}:`, responseText)
          results.push({ id: repasse.id, success: false, error: "Erro HTTP ao consultar BTG" })
          continue
        }

        // De acordo com a documentação, a resposta tem a propriedade "data" com a lista de pagamentos
        const paymentsData = responseJson?.data || []
        
        if (paymentsData.length === 0) {
          results.push({ id: repasse.id, success: false, error: "Lote não retornou pagamentos na API" })
          continue
        }

        const btgPayment = paymentsData[0]
        const btgStatus = btgPayment.status // "CONFIRMED", "CREATED", "CANCELED", "FAILED", "PROCESSED", "ADJOURNED", "REVERTED", "SCHEDULED", "PENDING", "WAITING_APPROVAL"

        let nextStatus = repasse.status
        let erro = null

        // Mapeamento
        if (["CONFIRMED", "PAID", "LIQUIDATED"].includes(btgStatus)) {
          nextStatus = "pago"
        } else if (["PENDING", "WAITING_APPROVAL", "CREATED", "SCHEDULED"].includes(btgStatus)) {
          nextStatus = "aguardando_aprovacao_btg"
        } else if (["PROCESSED"].includes(btgStatus)) {
          nextStatus = "processando"
        } else if (["FAILED", "REJECTED", "ERROR", "CANCELED", "REVERTED", "ADJOURNED"].includes(btgStatus)) {
          nextStatus = "erro"
          erro = `BTG falhou com status: ${btgStatus}`
        }

        if (nextStatus !== repasse.status) {
          await supabaseAdmin
            .from("repasses_profissionais")
            .update({
              status: nextStatus,
              erro: erro,
              updated_at: new Date().toISOString()
            })
            .eq("id", repasse.id)
        }

        results.push({ 
          id: repasse.id, 
          success: true, 
          oldStatus: repasse.status, 
          newStatus: nextStatus,
          btgStatus: btgStatus
        })

      } catch (err: any) {
        console.error(`Erro interno ao processar repasse ${repasse.id}:`, err)
        results.push({ id: repasse.id, success: false, error: err.message })
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
