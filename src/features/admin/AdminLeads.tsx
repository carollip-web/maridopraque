import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["profissionais_pre_cadastro"]["Row"];

export function AdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
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
    const { error } = await supabase
      .from("profissionais_pre_cadastro")
      .update({ status: newStatus })
      .eq("id", id);
    
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success("Status atualizado");
      setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l));
    }
  };

  const openWhatsApp = (telefone: string) => {
    const number = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${number}?text=Olá! Vimos seu interesse em se tornar parceiro do Marido pra Quê.`, "_blank");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Leads (Pré-Cadastros)</h2>
          <p className="text-slate-500">Profissionais que demonstraram interesse pela landing page.</p>
        </div>
        <Button onClick={fetchLeads} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
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
                      <TableCell className="font-medium">{lead.nome}</TableCell>
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
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openWhatsApp(lead.telefone)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Chamar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
