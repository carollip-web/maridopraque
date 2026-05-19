import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )
  const { error } = await supabase.rpc("limpar_reservas_temporarias_expiradas")
  if (error) {
    console.error("[cron-limpeza-agenda] Erro:", error.message)
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
  }
  console.log("[cron-limpeza-agenda] Limpeza executada com sucesso.")
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})
