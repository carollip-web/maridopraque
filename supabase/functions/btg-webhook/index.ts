import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const payload = await req.json()
    console.log("Recebido Webhook BTG:", payload)

    // O BTG Pactual Pix Lote geralmente envia um identificador da transação (ex: id ou payment.id)
    // Extraia o status e o ID. Esse mock cobre estruturas comuns de webhook:
    const transferId = payload.id || payload.payment?.id || payload.transactionId
    const status = payload.status || payload.event || payload.payment?.status

    if (!transferId) {
      return new Response("Webhook recebido, mas sem ID de transferência", { status: 200 })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Encontrar o repasse correspondente
    const { data: repasse, error: findErr } = await supabaseAdmin
      .from("repasses_profissionais")
      .select("*")
      .eq("btg_transfer_id", transferId)
      .maybeSingle()

    if (findErr || !repasse) {
      console.log(`Repasse não encontrado para btg_transfer_id = ${transferId}`)
      return new Response("Repasse não encontrado", { status: 200 })
    }

    // 2. Definir o novo status
    let novoStatus = repasse.status
    let isSuccess = false
    let isFailed = false

    const statusStr = String(status).toUpperCase()

    if (statusStr.includes("SUCCESS") || statusStr.includes("APPROVED") || statusStr.includes("PAGO") || statusStr.includes("COMPLETED")) {
      novoStatus = "pago"
      isSuccess = true
    } else if (statusStr.includes("FAIL") || statusStr.includes("ERROR") || statusStr.includes("REJECTED")) {
      novoStatus = "falhou"
      isFailed = true
    } else {
      console.log(`Status não mapeado: ${statusStr}`)
      return new Response("Status ignorado", { status: 200 })
    }

    if (repasse.status === novoStatus) {
      return new Response("Repasse já está neste status", { status: 200 })
    }

    // 3. Atualizar o Banco
    const updateData: any = {
      status: novoStatus,
      btg_response_payload: payload,
    }

    if (isSuccess) {
      updateData.paid_at = new Date().toISOString()
    }
    if (isFailed) {
      updateData.failed_at = new Date().toISOString()
      updateData.erro = payload.reason || payload.errorMessage || "Falha no processamento pelo BTG"
    }

    await supabaseAdmin
      .from("repasses_profissionais")
      .update(updateData)
      .eq("id", repasse.id)

    // 4. Criar Notificação para o Profissional
    let titulo = ""
    let mensagem = ""

    if (isSuccess) {
      titulo = "Repasse Concluído"
      mensagem = `Seu repasse no valor de R$ ${repasse.valor_liquido.toFixed(2).replace('.', ',')} foi transferido com sucesso para sua conta via Pix.`
    } else if (isFailed) {
      titulo = "Falha no Repasse"
      mensagem = `Houve um problema ao transferir seu repasse de R$ ${repasse.valor_liquido.toFixed(2).replace('.', ',')}. Nossa equipe já foi notificada.`
    }

    await supabaseAdmin
      .from("notificacoes")
      .insert({
        user_id: repasse.profissional_id,
        titulo,
        mensagem,
        lida: false
      })

    return new Response(JSON.stringify({ success: true }), { status: 200 })

  } catch (error: any) {
    console.error("Erro no btg-webhook:", error)
    // Sempre retornar 200 para webhooks se o erro for de formato para o parceiro não ficar tentando retry em loop (dependendo do erro)
    return new Response(JSON.stringify({ error: error.message }), { status: 200 })
  }
})
