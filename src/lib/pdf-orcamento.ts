import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRL = (n: number | null | undefined) =>
  `R$ ${Number(n ?? 0).toFixed(2).replace(".", ",")}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR") : "—";

const STATUS_LABEL: Record<string, string> = {
  customizado_pendente: "Aguardando profissional",
  fixo_auto: "Aprovado automaticamente",
  enviado: "Aguardando aprovação",
  aprovado: "Aprovado",
  pago: "Pago",
  agendado: "Agendado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export async function gerarPdfOrcamento(orcamentoId: string) {
  // Carrega orçamento + materiais + cliente + profissional
  const { data: orc, error } = await supabase
    .from("orcamentos")
    .select("*")
    .eq("id", orcamentoId)
    .single();
  if (error || !orc) throw new Error("Não foi possível carregar o orçamento");

  const [{ data: cliente }, profRes, { data: materiais }] = await Promise.all([
    supabase.from("profiles").select("nome,email,whatsapp").eq("id", orc.cliente_id).maybeSingle(),
    orc.profissional_id
      ? supabase.from("profiles").select("nome,email,whatsapp").eq("id", orc.profissional_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase
      .from("orcamento_materiais")
      .select("nome_snapshot, unidade_snapshot, quantidade, preco_unitario, subtotal")
      .eq("orcamento_id", orcamentoId),
  ]);
  const profissional = (profRes as any)?.data ?? null;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Cabeçalho
  doc.setFillColor(184, 92, 69); // brand
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Marido pra Que", margin, 32);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Orçamento de serviço", margin, 52);
  doc.setFontSize(9);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, pageW - margin, 52, { align: "right" });

  y = 100;
  doc.setTextColor(20, 20, 20);

  // Título serviço
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(orc.service_name || "Serviço", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text(
    `Pedido #${String(orc.id).slice(0, 8).toUpperCase()}  •  Status: ${STATUS_LABEL[orc.status] || orc.status}`,
    margin,
    y,
  );
  y += 22;

  // Dados cliente / profissional
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Cliente", margin, y);
  if (profissional) doc.text("Profissional", pageW / 2 + 10, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const clienteLines = [
    cliente?.nome || "—",
    cliente?.email || "",
    cliente?.whatsapp || "",
  ].filter(Boolean);
  clienteLines.forEach((l, i) => doc.text(l, margin, y + i * 13));
  if (profissional) {
    const profLines = [
      profissional.nome || "—",
      profissional.email || "",
      profissional.whatsapp || "",
    ].filter(Boolean);
    profLines.forEach((l, i) => doc.text(l, pageW / 2 + 10, y + i * 13));
  }
  y += Math.max(clienteLines.length, profissional ? 3 : 1) * 13 + 16;

  // Descrição
  if (orc.descricao) {
    doc.setFont("helvetica", "bold");
    doc.text("Descrição", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(orc.descricao, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 13 + 10;
  }

  // Datas
  doc.setFont("helvetica", "bold");
  doc.text("Informações", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  const infos: [string, string][] = [
    ["Solicitado em", fmtDate(orc.created_at)],
    ["Aprovação", fmtDate(orc.data_aprovacao)],
    ["Agendado para", fmtDate(orc.data_agendada)],
    ["Pagamento", fmtDate(orc.data_pagamento)],
  ];
  infos.forEach(([k, v], i) => {
    doc.setTextColor(110, 110, 110);
    doc.text(k, margin, y + i * 13);
    doc.setTextColor(20, 20, 20);
    doc.text(v, margin + 110, y + i * 13);
  });
  y += infos.length * 13 + 10;

  // Tabela de materiais
  const matRows = (materiais || []).map((m: any) => [
    m.nome_snapshot,
    `${Number(m.quantidade)} ${m.unidade_snapshot}`,
    BRL(m.preco_unitario),
    BRL(m.subtotal ?? Number(m.quantidade) * Number(m.preco_unitario)),
  ]);
  if (matRows.length) {
    autoTable(doc, {
      startY: y,
      head: [["Material", "Quantidade", "Unitário", "Subtotal"]],
      body: matRows,
      theme: "striped",
      headStyles: { fillColor: [184, 92, 69], textColor: 255 },
      styles: { fontSize: 10 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // Totais
  const valorServico = Number(orc.valor_servico ?? 0);
  const taxaMaterial = Number(orc.taxa_material ?? 0);
  const total = Number(orc.valor ?? valorServico + taxaMaterial);

  const rightX = pageW - margin;
  const labelX = pageW - margin - 180;
  const totals: [string, string, boolean?][] = [
    ["Mão de obra", BRL(valorServico)],
    ["Materiais", BRL(taxaMaterial)],
    ["Total", BRL(total), true],
  ];
  totals.forEach(([k, v, bold]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 13 : 11);
    doc.text(k, labelX, y);
    doc.text(v, rightX, y, { align: "right" });
    y += bold ? 20 : 16;
  });

  // Rodapé
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    "Documento gerado pela plataforma Marido pra Que. Os valores podem variar conforme avaliação no local.",
    margin,
    pageH - 24,
  );

  doc.save(`orcamento-${String(orc.id).slice(0, 8)}.pdf`);
}
