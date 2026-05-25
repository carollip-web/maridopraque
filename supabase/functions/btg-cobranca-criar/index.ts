import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[btg-cobranca-criar] start");

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // 1. Obter usuário autenticado
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.log("[btg-cobranca-criar] erro: usuário não autenticado ou token inválido");
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Receber parâmetros
    const body = await req.json().catch(() => ({}));
    const orcamento_id = body.orcamentoId || body.orcamento_id;
    
    if (!orcamento_id) {
      console.log("[btg-cobranca-criar] erro: orcamentoId/orcamento_id não fornecido");
      return new Response(JSON.stringify({ error: "Pedido não encontrado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO [idempotência]:
    // Quando a tabela final de cobranças criada via Lovable Cloud existir no banco de dados,
    // devemos buscar se já existe uma cobrança ativa associada a este orcamento_id para evitar
    // duplicidade e reuso do mesmo Pix/QR Code se ainda estiver dentro da validade:
    //
    // const { data: cobrancaAtiva, error: queryError } = await supabaseAdmin
    //   .from("btg_cobrancas") // nome fictício/final da tabela
    //   .select("*")
    //   .eq("orcamento_id", orcamento_id)
    //   .eq("status", "ativa") // ou status correspondente a ativo/pendente de pagamento
    //   .maybeSingle();
    //
    // Se a cobrança ativa já existir, retornar a existente diretamente:
    // if (cobrancaAtiva) {
    //   console.log("[btg-cobranca-criar] retornando cobrança ativa existente");
    //   return new Response(JSON.stringify({
    //     txId: cobrancaAtiva.tx_id,
    //     emv: cobrancaAtiva.emv,
    //     qrcode_url: cobrancaAtiva.qrcode_url,
    //     status: cobrancaAtiva.status,
    //     expiresAt: cobrancaAtiva.expires_at,
    //     amount: cobrancaAtiva.amount,
    //     orcamentoId: cobrancaAtiva.orcamento_id,
    //   }), {
    //     status: 200,
    //     headers: { ...corsHeaders, "Content-Type": "application/json" },
    //   });
    // }
    //
    // Se houver uma cobrança expirada, criar nova cobrança depois que a tabela
    // suportar status/expiração e atualizar o status da anterior para expirada/cancelada.

    // 3. Checar variável de ambiente obrigatória (Chave Pix Recebedora)
    const btgPixKey = Deno.env.get("BTG_PIX_KEY_RECEBEDORA");
    if (!btgPixKey) {
      console.log("[btg-cobranca-criar] erro: BTG_PIX_KEY_RECEBEDORA ausente");
      return new Response(JSON.stringify({ error: "Configuração BTG ausente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Usar um service_role client para buscar dados protegidos do orçamento e conexões
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 4. Buscar credenciais BTG
    const { data: btgConfig, error: btgError } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("access_token, company_id, token_expires_at, scope")
      .eq("provider", "btg")
      .maybeSingle();

    if (btgError || !btgConfig || !btgConfig.access_token || !btgConfig.company_id) {
      console.log("[btg-cobranca-criar] erro: configuração/integração BTG ausente no banco");
      return new Response(
        JSON.stringify({ error: "Configuração BTG ausente." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verifica token expirado
    const tokenExpired = btgConfig.token_expires_at
      ? new Date(btgConfig.token_expires_at) <= new Date()
      : true;

    if (tokenExpired) {
      console.log("[btg-cobranca-criar] erro: token BTG expirado");
      return new Response(
        JSON.stringify({ error: "Configuração BTG ausente." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Valida escopo
    const hasScope =
      typeof btgConfig.scope === "string" &&
      btgConfig.scope.includes("empresas.btgpactual.com/pix-cash-in");

    if (!hasScope) {
      console.log("[btg-cobranca-criar] erro: escopo pix-cash-in ausente na conexão BTG");
      return new Response(
        JSON.stringify({ error: "Configuração BTG ausente." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5. Buscar orçamento
    const { data: orcamento, error: orcError } = await supabaseAdmin
      .from("orcamentos")
      .select("id, cliente_id, status, valor_servico")
      .eq("id", orcamento_id)
      .maybeSingle();

    if (orcError || !orcamento) {
      console.log(`[btg-cobranca-criar] erro: orçamento não encontrado. id: ${orcamento_id}`);
      return new Response(JSON.stringify({ error: "Pedido não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida que cliente é dono do orçamento
    if (orcamento.cliente_id !== user.id) {
      console.log(`[btg-cobranca-criar] erro: usuário ${user.id} tentou acessar orçamento ${orcamento_id} que pertence a ${orcamento.cliente_id}`);
      return new Response(JSON.stringify({ error: "Você não tem permissão para pagar este pedido." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida que orçamento está em status aprovado/aguardando pagamento (aprovado ou fixo_auto)
    const statusPermitidos = ["aprovado", "fixo_auto"];
    if (!statusPermitidos.includes(orcamento.status)) {
      console.log(`[btg-cobranca-criar] erro: orçamento ${orcamento_id} possui status inválido: ${orcamento.status}`);
      return new Response(JSON.stringify({ error: "Pedido ainda não está aprovado para pagamento." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida valor_servico > 0
    const valorServico = Number(orcamento.valor_servico || 0);
    if (valorServico <= 0) {
      console.log(`[btg-cobranca-criar] erro: valor_servico do orçamento ${orcamento_id} é ${orcamento.valor_servico}`);
      return new Response(JSON.stringify({ error: "Valor do pedido inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[btg-cobranca-criar] orçamento validado");

    // 6. Montar payload do BTG
    const codigoCurto = String(orcamento_id).slice(0, 8).toUpperCase();
    const displayText = `Marido pra Quê - Pedido #${codigoCurto}`;

    const btgPayload = {
      pixKey: btgPixKey,
      amount: {
        original: valorServico,
        allowCustomerChangeValue: false,
      },
      expiresIn: 3600,
      displayText: displayText,
    };

    // Obter ambiente (sandbox ou production)
    const btgEnv = Deno.env.get("BTG_ENV") || "sandbox";
    const btgBaseUrl = btgEnv === "production"
      ? "https://api.empresas.btgpactual.com"
      : "https://api.sandbox.empresas.btgpactual.com";

    const btgRequestUrl = `${btgBaseUrl}/v1/companies/${btgConfig.company_id}/pix-cash-in/instant-collections`;

    // Log seguro sem vazar secrets/tokens/company_id ou chaves pix completas
    const maskedPixKey = btgPixKey.length > 5 
      ? btgPixKey.slice(0, 3) + "***" + btgPixKey.slice(-3) 
      : "***";

    console.log("[btg-cobranca-criar] criando cobrança BTG", { 
      env: btgEnv,
      amount: valorServico,
      pixKeyMasked: maskedPixKey
    });

    // 7. Fazer requisição
    const btgResponse = await fetch(btgRequestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${btgConfig.access_token}`,
        "Content-Type": "application/json",
        "x-idempotency-key": orcamento_id,
      },
      body: JSON.stringify(btgPayload),
    });

    const responseText = await btgResponse.text();
    let responseJson = null;
    try {
      if (responseText) responseJson = JSON.parse(responseText);
    } catch (e) {
      responseJson = { rawText: responseText };
    }

    // Log interno detalhado para depuração (mascara o response se necessário, não vaza access_token)
    if (!btgResponse.ok) {
      console.log(`[btg-cobranca-criar] erro: falha na API BTG. status: ${btgResponse.status}, response:`, responseJson);
      return new Response(
        JSON.stringify({ error: "Erro ao criar cobrança Pix BTG." }),
        {
          status: btgResponse.status === 401 || btgResponse.status === 403 ? btgResponse.status : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 8. Sucesso: Extrair campos relevantes
    const result = {
      txId: responseJson?.txId,
      emv: responseJson?.emv,
      qrcode_url: responseJson?.location?.url,
      status: responseJson?.status || "ATIVA",
      expiresAt: responseJson?.expiresAt || new Date(Date.now() + 3600 * 1000).toISOString(),
      amount: valorServico,
      orcamentoId: orcamento_id,
    };

    console.log(`[btg-cobranca-criar] cobrança criada`, { txId: result.txId });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error: any) {
    console.error(`[btg-cobranca-criar] erro: fatal na edge function:`, error);
    return new Response(JSON.stringify({ error: "Erro ao criar cobrança Pix BTG." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
