import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, RefreshCw, Plus, Link as LinkIcon, Copy, Trash2, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Lead = {
  id: string;
  created_at: string;
  nome: string;
  telefone: string;
  cidade: string;
  especialidade_principal: string;
  status: string;
  oferece_apoio_feminino?: boolean;
};
const db = supabase as any;

export function AdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    nome: "",
    telefone: "",
    cidade: "",
    especialidade: "Elétrica",
  });

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("profissionais_pre_cadastro")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar leads", { description: error.message });
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await db
      .from("profissionais_pre_cadastro")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success("Status atualizado");
      setLeads(leads.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    }
  };

  const openWhatsApp = (lead: { id: string; telefone: string; nome: string }) => {
    const number = lead.telefone.replace(/\D/g, "");
    const link = `${window.location.origin}/convite?id=${lead.id}`;
    const msg = encodeURIComponent(
      `Olá, ${lead.nome.split(" ")[0]}! 👋\n\n` +
      `Aqui é da equipe *Marido pra Quê?*, a plataforma de serviços domésticos de Copacabana e Ipanema.\n\n` +
      `Vimos seu interesse em ser um parceiro nosso — e sua vaga está garantida! 🎉\n\n` +
      `Para começar, é só clicar no link abaixo, criar sua conta e preencher seus dados:\n\n` +
      `👉 ${link}\n\n` +
      `Qualquer dúvida, pode responder aqui mesmo. Bem-vindo(a)!`
    );
    window.open(`https://wa.me/55${number}?text=${msg}`, "_blank");
    // Marca como convidado automaticamente
    updateStatus(lead.id, "convidado");
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o lead "${nome}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await db.from("profissionais_pre_cadastro").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Lead excluído.");
    fetchLeads();
  };

  const handleExport = () => {
    if (leads.length === 0) {
      toast.error("Nenhum lead para exportar.");
      return;
    }
    const header = "Data,Nome,Especialidade,Cidade,Status,Telefone\n";
    const rows = leads.map((l: any) => 
      `${new Date(l.created_at).toLocaleDateString("pt-BR")},${l.nome},${l.especialidade_principal},${l.cidade},${l.status},${l.telefone}`
    ).join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_marido_pra_que_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const generateInviteLink = async (id: string) => {
    const link = `${window.location.origin}/convite?id=${id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado para a área de transferência!");
      // Automatically update status to convidado
      updateStatus(id, "convidado");
    } catch (err) {
      toast.error("Erro ao copiar o link.");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const payload = {
        nome: addForm.nome,
        telefone: addForm.telefone.replace(/\D/g, ""),
        cidade: addForm.cidade,
        especialidade_principal: addForm.especialidade,
        oferece_apoio_feminino: false,
      };
      const { error } = await db.from("profissionais_pre_cadastro").insert(payload);
      if (error) throw error;
      toast.success("Lead adicionado com sucesso!");
      setAddModalOpen(false);
      setAddForm({ nome: "", telefone: "", cidade: "", especialidade: "Elétrica" });
      fetchLeads();
    } catch (err: any) {
      toast.error("Erro ao adicionar lead", { description: err.message });
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Leads (Pré-Cadastros)
          </h2>
          <p className="text-slate-500">
            Profissionais que demonstraram interesse pela landing page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExport} variant="outline" className="rounded-2xl font-bold">
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button
            onClick={() => setAddModalOpen(true)}
            className="bg-brand text-brand-foreground font-bold shadow-brand"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Profissional
          </Button>
          <Button onClick={fetchLeads} variant="outline" size="icon">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interessados</CardTitle>
          <CardDescription>Gerencie o funil de entrada de novos parceiros.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum pré-cadastro encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1 items-start">
                          <span>{lead.nome}</span>
                          {lead.oferece_apoio_feminino && (
                            <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200">
                              Apoio feminino
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{lead.especialidade_principal}</TableCell>
                      <TableCell>{lead.cidade}</TableCell>
                      <TableCell>
                        <select
                          value={lead.status}
                          onChange={(e) => updateStatus(lead.id, e.target.value)}
                          className="text-sm border rounded px-2 py-1 bg-transparent"
                        >
                          <option value="novo">Novo</option>
                          <option value="em_contato">Em Contato</option>
                          <option value="convidado">Convidado</option>
                          <option value="descartado">Descartado</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gerar e copiar link de convite"
                            onClick={() => generateInviteLink(lead.id)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Chamar no WhatsApp"
                            onClick={() => openWhatsApp(lead)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir lead"
                            onClick={() => handleDelete(lead.id, lead.nome)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Lead Manualmente</DialogTitle>
            <DialogDescription>
              Cadastre um profissional que você conheceu fora do fluxo público.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4 mt-2">
            <div className="space-y-1">
              <label className="text-sm font-semibold">Nome completo</label>
              <input
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Nome do profissional"
                value={addForm.nome}
                onChange={(e) => setAddForm({ ...addForm, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold">WhatsApp</label>
              <input
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="(11) 99999-9999"
                value={addForm.telefone}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                  const formatted = v
                    .replace(/(\d{2})(\d)/, "($1) $2")
                    .replace(/(\d{5})(\d{4})$/, "$1-$2");
                  setAddForm({ ...addForm, telefone: formatted });
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold">Cidade de atuação</label>
              <input
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Ex: São Paulo - SP"
                value={addForm.cidade}
                onChange={(e) => setAddForm({ ...addForm, cidade: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold">Especialidade Principal</label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={addForm.especialidade}
                onChange={(e) => setAddForm({ ...addForm, especialidade: e.target.value })}
              >
                <option value="Elétrica">Elétrica</option>
                <option value="Hidráulica">Hidráulica</option>
                <option value="Montagem de Móveis">Montagem de Móveis</option>
                <option value="Pintura">Pintura</option>
                <option value="Chaveiro">Chaveiro</option>
                <option value="Reformas e Alvenaria">Reformas e Alvenaria</option>
                <option value="Limpeza">Limpeza</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <Button
              type="submit"
              disabled={addLoading}
              className="w-full font-bold bg-brand text-brand-foreground mt-4"
            >
              {addLoading ? "Adicionando..." : "Adicionar Profissional"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
