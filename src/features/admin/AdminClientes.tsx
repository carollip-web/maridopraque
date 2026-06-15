import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Users,
  Search,
  FileDown,
  Trash2,
  UserPlus,
  Loader2,
  RefreshCw,
  X,
  Mail,
  MapPin,
  MessageSquare,
  Star,
  LifeBuoy,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarUsuarioAdmin, excluirUsuarioAdmin } from "@/lib/usuarios.functions";

const STATUS_COLORS: Record<string, string> = {
  customizado_pendente: "bg-amber-100 text-amber-700",
  enviado: "bg-blue-100 text-blue-700",
  aprovado: "bg-indigo-100 text-indigo-700",
  pago: "bg-emerald-100 text-emerald-700",
  concluido: "bg-green-100 text-green-700",
  cancelado: "bg-slate-200 text-slate-600",
  em_disputa: "bg-red-100 text-red-700",
  disputa_resolvida: "bg-purple-100 text-purple-700",
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const onlyDigits = (s?: string | null) => (s || "").replace(/\D/g, "");

function ClienteDetailPanel({
  cliente,
  onClose,
}: {
  cliente: any;
  onClose: () => void;
}) {
  const id = cliente.id;
  const [showAllOrders, setShowAllOrders] = useState(false);

  const { data: endereco } = useQuery({
    queryKey: ["admin", "cliente-detail", id, "endereco"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cliente_enderecos")
        .select("*")
        .eq("user_id", id)
        .order("is_padrao", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ["admin", "cliente-detail", id, "orcamentos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orcamentos")
        .select("id, service_name, status, valor, valor_total, created_at, profissional_id")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false });
      const list = data || [];
      const profIds = Array.from(
        new Set(list.map((o: any) => o.profissional_id).filter(Boolean)),
      );
      let profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", profIds as string[]);
        profMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p.nome]));
      }
      return list.map((o: any) => ({ ...o, profissional_nome: profMap[o.profissional_id] }));
    },
  });

  const { data: financeiro } = useQuery({
    queryKey: ["admin", "cliente-detail", id, "financeiro"],
    queryFn: async () => {
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select("id")
        .eq("cliente_id", id);
      const ids = (orcs || []).map((o: any) => o.id);
      if (ids.length === 0) return { total: 0, count: 0, ticket: 0 };
      const { data: pags } = await supabase
        .from("pagamentos")
        .select("valor_total, status, orcamento_id")
        .in("orcamento_id", ids)
        .eq("status", "paid");
      const total = (pags || []).reduce(
        (sum: number, p: any) => sum + Number(p.valor_total || 0),
        0,
      );
      const count = (pags || []).length;
      return { total, count, ticket: count > 0 ? total / count : 0 };
    },
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["admin", "cliente-detail", id, "avaliacoes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("avaliacoes")
        .select("id, nota, comentario, created_at, orcamento_id")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false });
      const list = data || [];
      const orcIds = list.map((a: any) => a.orcamento_id).filter(Boolean);
      let nameMap: Record<string, string> = {};
      if (orcIds.length > 0) {
        const { data: orcs } = await supabase
          .from("orcamentos")
          .select("id, service_name")
          .in("id", orcIds);
        nameMap = Object.fromEntries(
          (orcs || []).map((o: any) => [o.id, o.service_name]),
        );
      }
      return list.map((a: any) => ({ ...a, service_name: nameMap[a.orcamento_id] }));
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["admin", "cliente-detail", id, "tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suporte_tickets")
        .select("id, assunto, status, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const enderecoFmt = endereco
    ? [
        [endereco.logradouro, endereco.numero].filter(Boolean).join(", "),
        endereco.complemento,
        endereco.bairro,
        [endereco.cidade, endereco.uf].filter(Boolean).join(" - "),
        endereco.cep ? `CEP ${endereco.cep}` : null,
      ]
        .filter(Boolean)
        .join(" • ")
    : null;

  const visibleOrders = showAllOrders ? orcamentos : orcamentos.slice(0, 10);
  const waDigits = onlyDigits(cliente.whatsapp);

  return (
    <div className="w-full lg:w-[420px] shrink-0">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-20 overflow-hidden max-h-[calc(100vh-6rem)] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center font-bold text-lg shrink-0">
                {cliente.nome?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <p className="font-bold truncate">{cliente.nome || "Sem nome"}</p>
                <p className="text-xs text-white/60 truncate">{cliente.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {/* PERFIL */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Perfil
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <span className="truncate">{cliente.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                {waDigits ? (
                  <a
                    href={`https://wa.me/${waDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    {cliente.whatsapp}
                  </a>
                ) : (
                  <span className="text-slate-400">Sem WhatsApp</span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Membro desde{" "}
                {new Date(cliente.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </section>

          {/* ENDEREÇO */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Endereço
            </h3>
            <div className="flex gap-2 text-sm text-slate-600">
              <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p>{enderecoFmt || <span className="text-slate-400">Endereço não cadastrado</span>}</p>
            </div>
          </section>

          {/* FINANCEIRO */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Resumo financeiro
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 font-medium">Total gasto</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {fmtBRL(financeiro?.total || 0)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 font-medium">Pedidos pagos</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {financeiro?.count || 0}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 font-medium">Ticket médio</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {fmtBRL(financeiro?.ticket || 0)}
                </p>
              </div>
            </div>
          </section>

          {/* HISTÓRICO */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Histórico de pedidos
            </h3>
            {orcamentos.length === 0 && (
              <p className="text-xs text-slate-400">Nenhum pedido.</p>
            )}
            <div className="space-y-2">
              {visibleOrders.map((o: any) => (
                <div
                  key={o.id}
                  className="border border-slate-100 rounded-xl p-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-900 truncate">{o.service_name}</p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        STATUS_COLORS[o.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-slate-500">
                    <span>{o.profissional_nome || "—"}</span>
                    <span className="font-bold text-slate-700">
                      {fmtBRL(Number(o.valor_total ?? o.valor ?? 0))}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
            {orcamentos.length > 10 && !showAllOrders && (
              <button
                onClick={() => setShowAllOrders(true)}
                className="mt-2 text-xs font-bold text-brand hover:underline"
              >
                Ver todos ({orcamentos.length})
              </button>
            )}
          </section>

          {/* AVALIAÇÕES */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Avaliações dadas
            </h3>
            {avaliacoes.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma avaliação</p>
            ) : (
              <div className="space-y-2">
                {avaliacoes.map((a: any) => (
                  <div key={a.id} className="border border-slate-100 rounded-xl p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className="h-3 w-3"
                            fill={i < a.nota ? "currentColor" : "none"}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {new Date(a.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {a.service_name && (
                      <p className="text-[10px] text-slate-500 mt-1 font-medium">
                        {a.service_name}
                      </p>
                    )}
                    {a.comentario && (
                      <p className="text-slate-600 mt-1 line-clamp-2">{a.comentario}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* TICKETS */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Tickets de suporte
            </h3>
            {tickets.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum chamado</p>
            ) : (
              <div className="space-y-2">
                {tickets.map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 border border-slate-100 rounded-xl p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{t.assunto}</p>
                      <p className="text-[10px] text-slate-400">
                        {t.created_at
                          ? new Date(t.created_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* AÇÕES */}
          <section className="pt-2 border-t border-slate-100 space-y-2">
            {waDigits ? (
              <a
                href={`https://wa.me/${waDigits}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-bold transition-colors"
              >
                <MessageSquare className="h-4 w-4" /> Contato via WhatsApp
              </a>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-2 w-full bg-slate-100 text-slate-400 rounded-xl py-2.5 text-sm font-bold cursor-not-allowed"
              >
                <MessageSquare className="h-4 w-4" /> Sem WhatsApp cadastrado
              </button>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <button
                      disabled
                      className="flex items-center justify-center gap-2 w-full bg-slate-50 text-slate-400 rounded-xl py-2.5 text-sm font-bold cursor-not-allowed border border-slate-100"
                    >
                      <LifeBuoy className="h-4 w-4" /> Ver mensagens
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Em breve</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </section>
        </div>
      </div>
    </div>
  );
}

export function AdminClientes() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const criarUsuarioFn = useServerFn(criarUsuarioAdmin);
  const excluirUsuarioFn = useServerFn(excluirUsuarioAdmin);
  const searchParams = (useSearch({ strict: false }) || {}) as any;
  const q = searchParams.cli_q || "";
  const setQ = (val: string) =>
    navigate({
      search: ((old: any) => ({ ...old, cli_q: val || undefined })) as any,
    });

  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [newClient, setNewClient] = useState({
    nome: "",
    email: "",
    password: "",
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const {
    data: clientes = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin", "clientes"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const proIds = new Set(
        (roles || []).filter((r: any) => r.role !== "cliente").map((r: any) => r.user_id),
      );
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, email, whatsapp, total_servicos_pagos, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      return (profs || []).filter((p: any) => !proIds.has(p.id));
    },
  });

  const handleCreateClient = async () => {
    if (!newClient.email || !newClient.nome || !newClient.password) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setIsCreating(true);
    try {
      const { ok } = await criarUsuarioFn({
        data: { ...newClient, role: "cliente" },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!ok) throw new Error("Erro ao criar cliente");

      toast.success("Cliente criado com sucesso!");
      setIsDialogOpen(false);
      setNewClient({ nome: "", email: "", password: "" });
      qc.invalidateQueries({ queryKey: ["admin", "clientes"] });
    } catch (e: any) {
      toast.error("Erro ao criar cliente", { description: e.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClient = async (id: string, nome: string) => {
    if (
      !confirm(
        `Tem certeza que deseja remover o cliente ${nome}? Todos os dados de acesso serão excluídos.`,
      )
    )
      return;
    setIsDeleting(id);
    try {
      const { ok } = await excluirUsuarioFn({
        data: { targetUserId: id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!ok) throw new Error("Erro ao excluir cliente");

      toast.success("Cliente removido.");
      setSelectedIds((prev) => prev.filter((sid) => sid !== id));
      qc.invalidateQueries({ queryKey: ["admin", "clientes"] });
    } catch (e: any) {
      toast.error("Erro ao remover", { description: e.message });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Tem certeza que deseja remover os ${selectedIds.length} clientes selecionados? Esta ação é irreversível.`,
      )
    )
      return;

    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const id of selectedIds) {
        const { ok } = await excluirUsuarioFn({
          data: { targetUserId: id },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (ok) successCount++;
        else failCount++;
      }

      if (successCount > 0) {
        toast.success(`${successCount} clientes removidos.`);
        setSelectedIds([]);
        qc.invalidateQueries({ queryKey: ["admin", "clientes"] });
      }
      if (failCount > 0) {
        toast.error(`Falha ao remover ${failCount} clientes.`);
      }
    } catch (e: any) {
      toast.error("Erro na exclusão em massa", { description: e.message });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((c) => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  const handleExportClients = () => {
    if (clientes.length === 0) return;
    const headers = ["ID", "Nome", "E-mail", "WhatsApp", "Pedidos Pagos", "Cadastro"];
    const rows = clientes.map((c: any) =>
      [
        c.id,
        c.nome || "—",
        c.email || "—",
        c.whatsapp || "—",
        c.total_servicos_pagos || 0,
        new Date(c.created_at).toLocaleDateString("pt-BR"),
      ]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `clientes_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = clientes.filter(
    (c) =>
      !q ||
      c.nome?.toLowerCase().includes(q.toLowerCase()) ||
      c.email?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-in fade-in duration-500">
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-6">
        <div>
          <h2 className="text-2xl font-bold">Base de Clientes</h2>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os {clientes.length} clientes cadastrados na plataforma.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportClients}
            className="rounded-full h-10 px-5 bg-white border-slate-200 hover:border-brand/30 hover:bg-slate-50 text-slate-600 transition-all shadow-sm gap-2"
          >
            <FileDown className="h-4 w-4" /> Exportar Base
          </Button>



          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-brand text-white rounded-full h-10 px-6 font-bold gap-2 shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all">
                <UserPlus className="h-4 w-4" /> Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Cliente</DialogTitle>
                <DialogDescription>
                  Crie uma conta de acesso para um novo cliente. Ele poderá fazer login com este
                  e-mail e senha.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    placeholder="João da Silva"
                    value={newClient.nome}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, nome: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="joao@exemplo.com"
                    value={newClient.email}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Senha Temporária</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={newClient.password}
                    onChange={(e) =>
                      setNewClient((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateClient}
                  disabled={isCreating}
                  className="bg-brand text-white"
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Cliente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por nome ou e-mail..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand/20 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
            <Checkbox
              id="select-all-clients"
              checked={filtered.length > 0 && selectedIds.length === filtered.length}
              onCheckedChange={toggleSelectAll}
              className="border-slate-300"
            />
            <label
              htmlFor="select-all-clients"
              className="text-xs font-bold text-slate-500 cursor-pointer select-none"
            >
              Selecionar Todos
            </label>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="text-slate-500 gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-4 border-b border-slate-50"
            >
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="space-y-1 text-right">
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400">Nenhum cliente encontrado para sua busca.</p>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {!isLoading &&
          filtered.map((c) => (
            <div
              key={c.id}
              className={`flex items-center justify-between py-4 hover:bg-slate-50/50 transition-colors group px-4 -mx-4 rounded-2xl ${selectedIds.includes(c.id) ? "bg-brand-soft/20" : ""}`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <Checkbox
                  checked={selectedIds.includes(c.id)}
                  onCheckedChange={() => toggleSelect(c.id)}
                  className="border-slate-300"
                />
                <div className="h-12 w-12 rounded-full bg-brand-soft text-brand flex items-center justify-center font-bold text-base shrink-0">
                  {c.nome?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 truncate">{c.nome || "Sem nome"}</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="truncate">{c.email}</span>
                    {c.whatsapp && (
                      <>
                        <span>·</span>
                        <span className="truncate">{c.whatsapp}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900">
                    {c.total_servicos_pagos} pedidos pagos
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Desde {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteClient(c.id, c.nome)}
                  disabled={isDeleting === c.id}
                  className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  {isDeleting === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
