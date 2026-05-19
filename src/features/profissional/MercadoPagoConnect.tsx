import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface MercadoPagoStatus {
  connected: boolean
  mp_user_id: string | null
  mp_connected_at: string | null
  mp_token_expires_at: string | null
}

export function MercadoPagoConnect() {
  const [status, setStatus] = useState<MercadoPagoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const loadStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("profissional_perfil")
        .select("mp_user_id, mp_connected_at, mp_token_expires_at")
        .eq("user_id", user.id)
        .maybeSingle()

      if (error) {
        console.error(error)
      }

      setStatus({
        connected: !!data?.mp_user_id,
        mp_user_id: data?.mp_user_id ?? null,
        mp_connected_at: data?.mp_connected_at ?? null,
        mp_token_expires_at: data?.mp_token_expires_at ?? null,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()

    // Verificar feedback de retorno do OAuth via URL params
    const url = new URL(window.location.href)
    if (url.searchParams.get("mp_connected") === "true") {
      toast.success("Mercado Pago conectado com sucesso!")
      url.searchParams.delete("mp_connected")
      window.history.replaceState({}, "", url.toString())
    }
    const mpError = url.searchParams.get("mp_error")
    if (mpError) {
      toast.error(`Erro ao conectar Mercado Pago: ${mpError}`)
      url.searchParams.delete("mp_error")
      window.history.replaceState({}, "", url.toString())
    }
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { data, error } = await supabase.functions.invoke("mercado-pago-oauth-start")
      if (error) throw error
      if (!data?.url) throw new Error("URL de autorização não retornada")
      
      // Redirecionar para o Mercado Pago
      window.location.href = data.url
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message ?? "Falha ao iniciar conexão com Mercado Pago")
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    )
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Mercado Pago</h3>
          <p className="text-sm text-muted-foreground">
            Conecte sua conta para receber pagamentos diretamente, com a comissão da plataforma descontada automaticamente.
          </p>
        </div>
        {status?.connected ? (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Conectado
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Não conectado
          </Badge>
        )}
      </div>

      {status?.connected ? (
        <div className="space-y-2 text-sm">
          <p><strong>ID Mercado Pago:</strong> {status.mp_user_id}</p>
          {status.mp_connected_at && (
            <p>
              <strong>Conectado em:</strong>{" "}
              {new Date(status.mp_connected_at).toLocaleString("pt-BR")}
            </p>
          )}
          <Button variant="outline" onClick={handleConnect} disabled={connecting}>
            {connecting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reconectando...</>
            ) : (
              <>Reconectar conta</>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-3 text-sm border border-amber-200 dark:border-amber-800">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              ⚠️ Você precisa conectar sua conta do Mercado Pago para receber pedidos.
            </p>
            <p className="text-amber-800 dark:text-amber-200 mt-1">
              Sem isso, clientes não conseguirão pagar pelos seus serviços.
            </p>
          </div>
          <Button onClick={handleConnect} disabled={connecting} className="w-full sm:w-auto">
            {connecting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Conectando...</>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Conectar Mercado Pago
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  )
}
