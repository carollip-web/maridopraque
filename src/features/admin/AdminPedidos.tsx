import { useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  FileDown,
  ChevronDown,
  Calendar,
  X,
  RefreshCw,
  Trash2,
  Mail,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { excluirPedidoAdmin } from "@/lib/orcamentos.functions";
import { STATUS_COLORS } from "./constants";

export function AdminPedidos() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const excluirPedidoFn = useServerFn(excluirPedidoAdmin);
  const searchParams = (useSearch({ strict: false }) || {}) as any;
  const search = searchParams.q || "";
  const filter = searchParams.status || "todos";
  const proFilter = searchParams.pro_id || "todos";
  const dateRange = searchParams.range || "all";

  const setSearch = (val: string) =>
    navigate({
      search: ((old: any) => ({ ...old, q: val || undefined })) as any,
    });
  const setFilter = (val: string) =>
    navigate({
      search: ((old: any) => ({ ...old, status: val || "todos" })) as any,
    });
  const setProFilter = (val: string) =>
    navigate({
      search: ((old: any) => ({ ...old, pro_id: val || "todos" })) as any,
    });
  const setDateRange = (val: string) =>
    navigate({
      search: ((old: any) => ({ ...old, range: val || "all" })) as any,
    });
  const clearFilters = () =>
    navigate({ search: ((old: any) => ({ tab: old.tab })) as any });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "orcamentos"],
    queryFn: async () => {
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("is_test", false)
        .order("created_at", { ascending: false })
        .limit(200);

      const list = orcs || [];
      const ids = Array.from(
        new Set(
          list
            .flatMap((o: any) => [o.cliente_id, o.profissional_id])
            .filter(Boolean),
        ),
      );
      const orcIds = list.map((o: any) => o.id);

      let profileMap: Record<string, any> = {};
      const materialsMap: Record<string, any[]> = {};

      const promises: Promise<any>[] = [];

      if (ids.length > 0) {
        promises.push(
          Promise.resolve(
            supabase.from("profiles").select("id, nome, email").in("id", ids),
          ).then(({ data }) => {
            profileMap = Object.fromEntries(
              (data || []).map((p: any) => [p.id, p]),
            );
          }),
        );
      }

      if (orcIds.length > 0) {
        promises.push(
          Promise.resolve(
            supabase
              .from("orcamento_materiais")
              .select("*")
              .in("orcamento_id", orcIds),
          ).then(({ data }) => {
            (data || []).forEach((m: any) => {
              if (!materialsMap[m.orcamento_id])
                materialsMap[m.orcamento_id] = [];
              materialsMap[m.orcamento_id].push(m);
            });
          }),
        );
      }

      await Promise.all(promises);

      return { orcamentos: list, profiles: profileMap, materials: materialsMap };
    },
  });

  const orcamentos = data?.orcamentos || [];
  const profiles = data?.profiles || {};
  const materials = data?.materials || {};

  const allPros = useMemo(() => {
    const ids = Array.from(
      new Set(orcamentos.map((o) => o.profissional_id).filter(Boolean)),
    );
    return ids
      .map((id: any) => profiles[id])
      .filter(Boolean)
      .sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""));
  }, [orcamentos, profiles]);

  const unifiedOrders = useMemo(() => {
    const groups: Record<string, any[]> = {};

    orcamentos.forEach((o: any) => {
      if (!o.created_at) return;
      const date = new Date(o.created_at);
      if (isNaN(date.getTime())) return;
      const timestamp = date.toISOString().slice(0, 19);
      const key = `${o.cliente_id}_${timestamp}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });

    return Object.values(groups)
      .map((items) => {
        const first = items[0];
        const totalValor = items.reduce(
          (sum, i) => sum + (Number(i.valor) || 0),
          0,
        );
        const totalServico = items.reduce(
          (sum, i) => sum + (Number(i.valor_servico) || 0),
          0,
        );
        const allServiceNames = items.map((i) => i.service_name).join(" + ");

        const allMats = items.flatMap((i) => materials[i.id] || []);

        return {
          ...first,
          id: first.id,
          service_name: allServiceNames,
          valor: totalValor,
          valor_servico: totalServico,
          items_count: items.length,
          _original_items: items,
          _unified_materials: allMats,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [orcamentos, materials]);

  const filtered = useMemo(() => {
    return unifiedOrders.filter((o) => {
      if (filter !== "todos" && o.status !== filter) return false;
      if (proFilter !== "todos" && o.profissional_id !== proFilter) return false;

      if (dateRange !== "all") {
        const d = new Date(o.created_at);
        const now = new Date();
        if (dateRange === "today") {
          if (d.toDateString() !== now.toDateString()) return false;
        } else if (dateRange === "week") {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          if (d < weekAgo) return false;
        } else if (dateRange === "month") {
          if (
            d.getMonth() !== now.getMonth() ||
            d.getFullYear() !== now.getFullYear()
          )
            return false;
        }
      }

      if (!search) return true;
      const q = search.toLowerCase();
      const cliente = profiles[o.cliente_id]?.nome?.toLowerCase() || "";
      const profissional = o.profissional_id
        ? profiles[o.profissional_id]?.nome?.toLowerCase() || ""
        : "";
      return (
        o.id.toLowerCase().includes(q) ||
        o.service_name?.toLowerCase().includes(q) ||
        cliente.includes(q) ||
        profissional.includes(q)
      );
    });
  }, [unifiedOrders, filter, search, profiles, proFilter, dateRange]);

  const tabs = [
    { id: "todos", label: `Todos (${unifiedOrders.length})` },
    {
      id: "customizado_pendente",
      label: `Pendentes (${unifiedOrders.filter((o) => o.status === "customizado_pendente").length})`,
    },
    {
      id: "enviado",
      label: `Enviados (${unifiedOrders.filter((o) => o.status === "enviado").length})`,
    },
    {
      id: "aprovado",
      label: `Aprovados (${unifiedOrders.filter((o) => o.status === "aprovado").length})`,
    },
    {
      id: "pago",
      label: `Pagos (${unifiedOrders.filter((o) => o.status === "pago").length})`,
    },
    {
      id: "agendado",
      label: `Agendados (${unifiedOrders.filter((o) => (o.status as string) === "agendado").length})`,
    },
    {
      id: "concluido",
      label: `Concluídos (${unifiedOrders.filter((o) => o.status === "concluido").length})`,
    },
    {
      id: "cancelado",
      label: `Cancelados (${unifiedOrders.filter((o) => o.status === "cancelado").length})`,
    },
    {
      id: "recusado",
      label: `Recusados (${unifiedOrders.filter((o) => o.status === "recusado").length})`,
    },
  ];

  const handleExport = () => {
    if (filtered.length === 0) return;
    const headers = [
      "ID_Completo",
      "Data",
      "Cliente_Nome",
      "Cliente_Email",
      "Servico_Nome",
      "Profissional_Nome",
      "Status",
      "Valor_Servico",
      "Valor_Materiais",
      "Valor_Total",
      "Materiais_Detalhe",
    ];

    const rows = filtered.map((o: any) => {
      const cli = profiles[o.cliente_id];
      const prof = o.profissional_id ? profiles[o.profissional_id] : null;
      const statusLabel = STATUS_COLORS[o.status]?.label || o.status;
      const oMats = materials[o.id] || [];
      const materialsList = oMats
        .map((m: any) => `${m.nome_snapshot} (x${m.quantidade})`)
        .join(" | ");
      const materialsTotal = oMats.reduce(
        (sum, m) => sum + Number(m.preco_unitario) * Number(m.quantidade),
        0,
      );

      return [
        o.id,
        new Date(o.created_at).toLocaleDateString("pt-BR"),
        cli?.nome || "—",
        cli?.email || "—",
        o.service_name || "—",
        prof?.nome || "—",
        statusLabel,
        o.valor_servico ? Number(o.valor_servico).toFixed(2) : "0.00",
        materialsTotal.toFixed(2),
        o.valor ? Number(o.valor).toFixed(2) : "0.00",
        materialsList || "Nenhum",
      ]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `pedidos_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isDeletingOrder, setIsDeletingOrder] = useState<string | null>(null);

  const handleDeleteOrder = async (order: any) => {
    const items = order._original_items || [order];
    const ids = items.map((i: any) => i.id);
    const msg =
      items.length > 1
        ? `Tem certeza que deseja excluir este pedido unificado? Isso removerá ${items.length} itens (IDs: ${ids.map((id: string) => id.slice(0, 8)).join(", ")}).`
        : `Tem certeza que deseja excluir o pedido #${order.id.slice(0, 8)}?`;

    if (!confirm(msg)) return;

    setIsDeletingOrder(order.id);
    try {
      for (const item of items) {
        const { ok, error: serverError } = await excluirPedidoFn({
          data: { orcamentoId: item.id },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });
        if (!ok) throw new Error(serverError || "Erro ao excluir um dos itens.");
      }

      toast.success("Pedido e todas as suas dependências foram excluídos.");
      setSelectedIds((prev) => prev.filter((id) => id !== order.id));
      qc.invalidateQueries({ queryKey: ["admin", "orcamentos"] });
    } catch (e: any) {
      toast.error("Erro ao excluir pedido", { description: e.message });
    } finally {
      setIsDeletingOrder(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Tem certeza que deseja excluir permanentemente os ${selectedIds.length} pedidos selecionados? Esta ação não pode ser desfeita.`,
      )
    )
      return;

    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const id of selectedIds) {
        const order = unifiedOrders.find((o) => o.id === id);
        if (!order) continue;

        const items = order._original_items || [order];
        let orderSuccess = true;

        for (const item of items) {
          const { ok } = await excluirPedidoFn({
            data: { orcamentoId: item.id },
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          if (!ok) orderSuccess = false;
        }

        if (orderSuccess) successCount++;
        else failCount++;
      }

      if (successCount > 0) {
        toast.success(`${successCount} pedidos excluídos com sucesso.`);
        setSelectedIds([]);
        qc.invalidateQueries({ queryKey: ["admin", "orcamentos"] });
      }
      if (failCount > 0) {
        toast.error(
          `Falha ao excluir ${failCount} pedidos. Verifique as dependências.`,
        );
      }
    } catch (e: any) {
      toast.error("Erro no processamento em lote", { description: e.message });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((o) => o.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Todos os Pedidos</h2>
          <p className="text-sm text-slate-500">
            Gerencie e acompanhe todos os serviços da plataforma.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="rounded-full gap-2 h-10 px-5 bg-white border-slate-200 hover:border-brand/30 hover:bg-slate-50 text-slate-600 transition-all shadow-sm"
          >
            <FileDown className="h-4 w-4" /> Exportar
          </Button>

          <div className="w-px h-6 bg-slate-200 mx-1 hidden xl:block" />

          <div className="relative min-w-[240px] flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente ou serviço..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 outline-none transition-all"
            />
          </div>

          <div className="relative min-w-[200px]">
            <select
              value={proFilter}
              onChange={(e) => setProFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 outline-none appearance-none transition-all"
            >
              <option value="todos">Todos Profissionais</option>
              {allPros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative min-w-[140px]">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 outline-none appearance-none transition-all"
            >
              <option value="all">Todo período</option>
              <option value="today">Hoje</option>
              <option value="week">Últimos 7 dias</option>
              <option value="month">Este mês</option>
            </select>
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2">
            {(search ||
              filter !== "todos" ||
              proFilter !== "todos" ||
              dateRange !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-slate-500 hover:text-red-500 gap-1 px-3 h-9 rounded-xl"
              >
                <X className="h-4 w-4" /> Limpar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full gap-2 bg-white border-slate-200 hover:border-brand/30 hover:bg-slate-50 text-slate-600 transition-all shadow-sm px-4"
              onClick={() => refetch()}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />{" "}
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full gap-2 bg-white text-red-500 hover:bg-red-50 hover:text-red-600 border-red-100 font-bold px-4 transition-all shadow-sm"
              onClick={async () => {
                const count = filtered.length;
                if (count === 0) return;
                const confirmText = prompt(
                  `ATENÇÃO: Você está prestes a excluir PERMANENTEMENTE os ${count} pedidos selecionados.\n\nPara confirmar, digite "EXCLUIR TUDO" abaixo:`,
                );
                if (confirmText === "EXCLUIR TUDO") {
                  setSelectedIds(filtered.map((o) => o.id));
                  setTimeout(() => handleBulkDelete(), 100);
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir Selecionados
            </Button>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-300">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 border border-white/10">
            <div className="flex items-center gap-2">
              <span className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {selectedIds.length}
              </span>
              <span className="text-sm font-medium">selecionados</span>
            </div>
            <div className="h-4 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <Button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-white/10 gap-2 h-9 rounded-xl font-bold"
              >
                {isBulkDeleting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir em massa
              </Button>
              <Button
                onClick={() => setSelectedIds([])}
                size="sm"
                variant="ghost"
                className="text-white/60 hover:text-white hover:bg-white/10 h-9 rounded-xl"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
                filter === t.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              <tr>
                <th className="px-6 py-4 w-10">
                  <Checkbox
                    checked={
                      filtered.length > 0 &&
                      selectedIds.length === filtered.length
                    }
                    onCheckedChange={toggleSelectAll}
                    className="border-slate-300"
                  />
                </th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Serviço & Materiais</th>
                <th className="px-6 py-4">Profissional</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Financeiro</th>
                <th className="px-6 py-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-4 w-40" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-6 w-20 rounded-md" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    </tr>
                  ))}
                </>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-400 text-sm"
                  >
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              )}
              {!isLoading &&
                filtered.map((o) => {
                  const meta = STATUS_COLORS[o.status] ?? {
                    bg: "bg-slate-100",
                    color: "text-slate-600",
                    label: o.status,
                  };
                  const cli = profiles[o.cliente_id];
                  const prof = o.profissional_id
                    ? profiles[o.profissional_id]
                    : null;
                  const oMats = o._unified_materials || [];
                  const matsTotal = oMats.reduce(
                    (sum: number, m: any) =>
                      sum + Number(m.preco_unitario) * Number(m.quantidade),
                    0,
                  );

                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-slate-50 transition-colors group ${selectedIds.includes(o.id) ? "bg-brand-soft/20" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <Checkbox
                          checked={selectedIds.includes(o.id)}
                          onCheckedChange={() => toggleSelect(o.id)}
                          className="border-slate-300"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono text-slate-400">
                            #{o.id.slice(0, 8)}
                          </span>
                          {o.items_count > 1 && (
                            <span className="text-[9px] font-bold text-brand uppercase mt-0.5">
                              {o.items_count} Itens
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">
                            {cli?.nome || "—"}
                          </span>
                          {cli?.whatsapp && (
                            <a
                              href={`https://wa.me/${cli.whatsapp.replace(/\D/g, "")}`}
                              target="_blank"
                              className="text-[10px] text-brand flex items-center gap-1 hover:underline mt-0.5"
                            >
                              <Mail className="h-2.5 w-2.5" /> WhatsApp
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700">
                            {o.service_name}
                          </span>
                          {oMats.length > 0 && (
                            <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                              {oMats
                                .map(
                                  (m: any) =>
                                    `${m.nome_snapshot} (x${m.quantidade})`,
                                )
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {prof ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">
                              {prof.nome}
                            </span>
                            {prof.whatsapp && (
                              <a
                                href={`https://wa.me/${prof.whatsapp.replace(/\D/g, "")}`}
                                target="_blank"
                                className="text-[10px] text-brand flex items-center gap-1 hover:underline mt-0.5"
                              >
                                <Mail className="h-2.5 w-2.5" /> WhatsApp
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 italic">
                            Não atribuído
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-tight inline-block ${meta.bg} ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">
                              R$ {Number(o.valor || 0).toFixed(2)}
                            </span>
                            {(o.valor_servico || matsTotal > 0) && (
                              <span className="text-[9px] text-slate-400 mt-0.5">
                                {o.valor_servico
                                  ? `S: R$ ${Number(o.valor_servico).toFixed(0)}`
                                  : ""}
                                {matsTotal > 0
                                  ? ` + M: R$ ${matsTotal.toFixed(0)}`
                                  : ""}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOrder(o)}
                            disabled={isDeletingOrder === o.id}
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 ml-auto transition-all"
                          >
                            {isDeletingOrder === o.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
