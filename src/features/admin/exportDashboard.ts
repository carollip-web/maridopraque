import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type ExportFormat = "csv" | "json";

/** Download helper: triggers browser save-as */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(["\uFEFF" + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Escape a CSV value (handles commas, quotes, newlines) */
function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Convert array of objects to CSV string */
function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

/** Status label in Portuguese */
function statusLabel(s: string): string {
  const map: Record<string, string> = {
    customizado_pendente: "Pendente",
    enviado: "Cotado",
    aprovado: "Aprovado",
    pago: "Pago",
    concluido: "Concluído",
    cancelado: "Cancelado",
    recusado: "Recusado",
    agendado: "Agendado",
  };
  return map[s] || s;
}

/** Fetch all dashboard data and export */
export async function exportDashboardData(fmt: ExportFormat = "csv") {
  const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm");

  // Fetch all data in parallel
  const [orcsRes, profsRes, avsRes, pagsRes, rolesRes, repassesRes] = await Promise.all([
    supabase
      .from("orcamentos")
      .select("id, status, valor, valor_servico, service_name, tipo_atendimento, is_test, created_at, cliente_id, descricao")
      .or("is_test.eq.false,is_test.is.null")
      .order("created_at", { ascending: false }),
    supabase.from("profissional_perfil").select("user_id, ativo, mp_user_id, cidade, estado, created_at"),
    supabase.from("avaliacoes").select("nota, created_at"),
    supabase.from("pagamentos").select("valor_total, status, orcamento_id, created_at"),
    supabase.from("user_roles").select("user_id, role"),
    supabase
      .from("repasses_profissionais")
      .select("created_at, status, valor_comissao_marketplace, valor_liquido"),
  ]);

  const orcs = orcsRes.data || [];
  const profs = profsRes.data || [];
  const avs = avsRes.data || [];
  const pags = pagsRes.data || [];
  const roles = rolesRes.data || [];
  const repasses = repassesRes.data || [];

  // ============ PEDIDOS (Orders) ============
  const pedidosRows = orcs.map((o) => ({
    "ID": o.id,
    "Serviço": o.service_name || "",
    "Status": statusLabel(o.status),
    "Valor (R$)": Number(o.valor || o.valor_servico || 0).toFixed(2),
    "Tipo Atendimento": o.tipo_atendimento || "",
    "Cliente ID": o.cliente_id || "",
    "Descrição": o.descricao || "",
    "Criado em": o.created_at ? format(new Date(o.created_at), "dd/MM/yyyy HH:mm") : "",
  }));

  // ============ PROFISSIONAIS ============
  const profsRows = profs.map((p) => ({
    "ID": p.user_id,
    "Ativo": p.ativo ? "Sim" : "Não",
    "MP Conectado": p.mp_user_id ? "Sim" : "Não",
    "Cidade": p.cidade || "",
    "Estado": p.estado || "",
    "Cadastro em": p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy") : "",
  }));

  // ============ PAGAMENTOS ============
  const pagsRows = pags.map((p) => ({
    "Orçamento ID": p.orcamento_id || "",
    "Valor Total (R$)": Number(p.valor_total || 0).toFixed(2),
    "Status": p.status || "",
    "Data": p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy HH:mm") : "",
  }));

  // ============ REPASSES ============
  const repassesRows = repasses.map((r) => ({
    "Status": r.status || "",
    "Comissão Marketplace (R$)": Number(r.valor_comissao_marketplace || 0).toFixed(2),
    "Valor Líquido Prof. (R$)": Number(r.valor_liquido || 0).toFixed(2),
    "Data": r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm") : "",
  }));

  // ============ KPIs RESUMO ============
  const pedidosPorStatus = {
    Total: orcs.length,
    Pendentes: orcs.filter((o) => o.status === "customizado_pendente").length,
    Cotados: orcs.filter((o) => o.status === "enviado").length,
    Aprovados: orcs.filter((o) => o.status === "aprovado").length,
    Pagos: orcs.filter((o) => o.status === "pago").length,
    Concluídos: orcs.filter((o) => o.status === "concluido").length,
    Cancelados: orcs.filter((o) => o.status === "cancelado").length,
  };

  const pagosAprovados = pags.filter((p) => p.status === "approved" || p.status === "pago");
  const totalFaturado = pagosAprovados.reduce((s, p) => s + Number(p.valor_total || 0), 0);

  const mediaAvaliacao =
    avs.length > 0 ? (avs.reduce((s, a) => s + a.nota, 0) / avs.length).toFixed(1) : "—";

  const nonClientIds = new Set(roles.filter((r) => r.role !== "cliente").map((r) => r.user_id));
  const clientesCount = roles
    .filter((r) => r.role === "cliente")
    .filter((r) => !nonClientIds.has(r.user_id)).length;

  const kpisRows = [
    { "Métrica": "Total de Pedidos", "Valor": pedidosPorStatus.Total },
    { "Métrica": "Pedidos Pendentes", "Valor": pedidosPorStatus.Pendentes },
    { "Métrica": "Pedidos Cotados", "Valor": pedidosPorStatus.Cotados },
    { "Métrica": "Pedidos Aprovados", "Valor": pedidosPorStatus.Aprovados },
    { "Métrica": "Pedidos Pagos", "Valor": pedidosPorStatus.Pagos },
    { "Métrica": "Pedidos Concluídos", "Valor": pedidosPorStatus["Concluídos"] },
    { "Métrica": "Pedidos Cancelados", "Valor": pedidosPorStatus.Cancelados },
    { "Métrica": "Total Profissionais", "Valor": profs.length },
    { "Métrica": "Profissionais Ativos", "Valor": profs.filter((p) => p.ativo).length },
    { "Métrica": "MP Conectados", "Valor": profs.filter((p) => p.mp_user_id).length },
    { "Métrica": "Média Avaliações", "Valor": mediaAvaliacao },
    { "Métrica": "Total Clientes", "Valor": clientesCount },
    { "Métrica": "Total Faturado (R$)", "Valor": totalFaturado.toFixed(2) },
    { "Métrica": "Comissão 15% (R$)", "Valor": (totalFaturado * 0.15).toFixed(2) },
    { "Métrica": "Ticket Médio (R$)", "Valor": pagosAprovados.length > 0 ? (totalFaturado / pagosAprovados.length).toFixed(2) : "0.00" },
  ];

  if (fmt === "json") {
    const exportData = {
      exportado_em: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
      kpis: kpisRows,
      pedidos: pedidosRows,
      profissionais: profsRows,
      pagamentos: pagsRows,
      repasses: repassesRows,
    };
    downloadFile(JSON.stringify(exportData, null, 2), `dashboard_${timestamp}.json`, "application/json");
  } else {
    // CSV: combine all sections with headers
    const sections = [
      { title: "=== KPIs RESUMO ===", rows: kpisRows },
      { title: "=== PEDIDOS ===", rows: pedidosRows },
      { title: "=== PROFISSIONAIS ===", rows: profsRows },
      { title: "=== PAGAMENTOS ===", rows: pagsRows },
      { title: "=== REPASSES ===", rows: repassesRows },
    ];

    const csvParts: string[] = [
      `Exportação Dashboard - Marido pra Quê?`,
      `Data: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`,
      "",
    ];

    for (const section of sections) {
      csvParts.push("");
      csvParts.push(section.title);
      if (section.rows.length > 0) {
        csvParts.push(toCSV(section.rows));
      } else {
        csvParts.push("(sem dados)");
      }
    }

    downloadFile(csvParts.join("\n"), `dashboard_${timestamp}.csv`, "text/csv");
  }
}
