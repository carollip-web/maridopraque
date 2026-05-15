import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const MP_ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

serve(async (req) => {
  const requestId = crypto.randomUUID()
  console.log(`[Webhook ${requestId}] Request received`)

  try {
    // Mercado Pago envia o ID do recurso via query param
    const { searchParams } = new URL(req.url)
    
    // Suporta tanto formato antigo (topic/id) quanto novo (type/data.id)
    const topic = searchParams.get("topic") || searchParams.get("type")
    const resourceId = searchParams.get("id") || searchParams.get("data.id")

    if (topic !== "payment") {
      console.log(`[Webhook ${requestId}] Ignorando tópico irrelevante: ${topic}`)
      return new Response(JSON.stringify({ message: "Topic ignored" }), { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      })
    }

    if (!resourceId) {
      console.error(`[Webhook ${requestId}] ID do recurso ausente`)
      return new Response(JSON.stringify({ error: "Missing resource ID" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      })
    }

    if (!MP_ACCESS_TOKEN) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado na Edge Function.")
    }

    // 1. Consultar o Mercado Pago para validar o pagamento (Segurança: não confiar apenas no body)
    console.log(`[Webhook ${requestId}] Consultando pagamento ${resourceId} no Mercado Pago...`)
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`
      }
    })

    if (!mpRes.ok) {
      const errorBody = await mpRes.text()
      throw new Error(`Erro ao buscar pagamento no MP: ${mpRes.status} - ${errorBody}`)
    }

    const mpPayment = await mpRes.json()
    const orcamentoId = mpPayment.external_reference
    const mpStatus = mpPayment.status // approved, rejected, pending, cancelled, etc
    
    console.log(`[Webhook ${requestId}] Status MP: ${mpStatus} para Orçamento: ${orcamentoId}`)

    if (!orcamentoId) {
      console.warn(`[Webhook ${requestId}] Pagamento sem external_reference. Ignorando.`)
      return new Response(JSON.stringify({ message: "External reference missing" }), { status: 200 })
    }

    // 2. Inicializar cliente Supabase com Service Role para bypass RLS
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 3. Mapear status MP para nosso sistema
    let finalStatus = "pending"
    if (mpStatus === "approved") finalStatus = "paid"
    else if (mpStatus === "cancelled") finalStatus = "canceled"
    else if (mpStatus === "rejected") finalStatus = "failed"
    else if (mpStatus === "in_mediation") finalStatus = "pending"

    // 4. Atualizar registro de pagamento
    const { data: pagamento, error: payError } = await supabase
      .from("pagamentos")
      .update({
        gateway_payment_id: String(resourceId),
        gateway_status: mpStatus,
        status: finalStatus,
        paid_at: mpStatus === "approved" ? new Date().toISOString() : null,
        webhook_last_received_at: new Date().toISOString(),
        metadata: {
          last_webhook_payload: mpPayment,
          updated_at: new Date().toISOString()
        }
      })
      .eq("orcamento_id", orcamentoId)
      .select()
      .maybeSingle()

    if (payError) throw payError

    if (!pagamento) {
      console.warn(`[Webhook ${requestId}] Registro de pagamento não encontrado para Orçamento ${orcamentoId}`)
    }

    // 5. Se aprovado, marcar orçamento como PAGO e confirmar reserva de agenda
    if (mpStatus === "approved") {
      console.log(`[Webhook ${requestId}] Marcando Orçamento ${orcamentoId} como PAGO...`)
      const { data: updatedOrc, error: orcError } = await supabase
        .from("orcamentos")
        .update({
          status: "pago",
          data_pagamento: new Date().toISOString()
        })
        .eq("id", orcamentoId)
        .select("id, profissional_id, data_preferida, periodo_preferido, horario_preferido")
        .single()
      
      if (orcError) throw orcError
      console.log(`[Webhook ${requestId}] Orçamento ${orcamentoId} atualizado com sucesso.`)

      // Confirmar reserva de agenda
      console.log(`[Webhook ${requestId}] Atualizando reserva de agenda para Orçamento ${orcamentoId}...`)
      const { data: existingBlocks, error: blockErr } = await supabase
        .from("profissional_bloqueios_agenda")
        .update({
          status: "confirmado",
          expires_at: null,
          motivo: "Pagamento confirmado"
        })
        .eq("orcamento_id", orcamentoId)
        .eq("status", "temporario")
        .select()
      
      if (blockErr) {
        console.error(`[Webhook ${requestId}] Erro ao atualizar reserva:`, blockErr)
      }

      if ((!existingBlocks || existingBlocks.length === 0) && updatedOrc.data_preferida) {
        console.log(`[Webhook ${requestId}] Nenhuma reserva temporária encontrada. Criando bloqueio confirmado...`)
        try {
          const baseDate = updatedOrc.data_preferida;
          let inicioStr = "";
          let fimStr = "";

          if (updatedOrc.periodo_preferido === "manha") {
            inicioStr = `${baseDate}T08:00:00Z`;
            fimStr = `${baseDate}T12:00:00Z`;
          } else if (updatedOrc.periodo_preferido === "tarde") {
            inicioStr = `${baseDate}T13:00:00Z`;
            fimStr = `${baseDate}T18:00:00Z`;
          } else if (updatedOrc.periodo_preferido === "noite") {
            inicioStr = `${baseDate}T18:00:00Z`;
            fimStr = `${baseDate}T21:00:00Z`;
          } else if (updatedOrc.periodo_preferido === "horario_especifico" && updatedOrc.horario_preferido) {
            inicioStr = `${baseDate}T${updatedOrc.horario_preferido}Z`;
            const d = new Date(inicioStr);
            d.setHours(d.getHours() + 2);
            fimStr = d.toISOString();
          }

          if (inicioStr && fimStr) {
            await supabase.from("profissional_bloqueios_agenda").insert({
              profissional_id: updatedOrc.profissional_id,
              orcamento_id: updatedOrc.id,
              inicio: new Date(inicioStr).toISOString(),
              fim: new Date(fimStr).toISOString(),
              status: "confirmado",
              motivo: "Pagamento confirmado (reserva direta)"
            });
          }
        } catch (e_agenda) {
          console.error(`[Webhook ${requestId}] Erro ao criar bloqueio confirmado:`, e_agenda)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    })

  } catch (err) {
    console.error(`[Webhook ${requestId}] ERRO:`, err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    })
  }
})
