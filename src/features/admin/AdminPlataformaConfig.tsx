import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Plus, Save, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getPlataformaConfig,
  updatePlataformaConfig,
  type WhatsappTemplate,
} from "@/lib/plataforma-config.functions";

export function AdminPlataformaConfig() {
  const fetchConfig = useServerFn(getPlataformaConfig);
  const saveConfig = useServerFn(updatePlataformaConfig);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["plataforma_config"],
    queryFn: () => fetchConfig(),
  });

  const [marcaNome, setMarcaNome] = useState("");
  const [assinatura, setAssinatura] = useState("");
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setMarcaNome(data.marca_nome);
      setAssinatura(data.marca_assinatura);
      setTemplates(data.whatsapp_templates ?? []);
    }
  }, [data]);

  const addTemplate = () => {
    setTemplates((prev) => [
      ...prev,
      { id: crypto.randomUUID(), titulo: "", mensagem: "" },
    ]);
  };

  const updateTemplate = (idx: number, patch: Partial<WhatsappTemplate>) => {
    setTemplates((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const removeTemplate = (idx: number) => {
    setTemplates((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig({
        data: {
          marca_nome: marcaNome,
          marca_assinatura: assinatura,
          whatsapp_templates: templates,
        },
      });
      toast.success("Configurações salvas.");
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="bg-white rounded-[2rem] border border-border p-8 shadow-sm">
        <p className="text-sm text-slate-500">Carregando configurações da plataforma…</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-[2rem] border border-border p-8 shadow-sm space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-slate-700 mt-0.5" />
          <div>
            <h3 className="font-bold text-lg text-slate-900">Plataforma</h3>
            <p className="text-sm text-slate-500">
              Nome/assinatura da marca e mensagens padrão usadas nos botões de contato.
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 text-white hover:bg-slate-800 rounded-full px-6 font-bold"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Nome da marca
          </label>
          <Input
            value={marcaNome}
            onChange={(e) => setMarcaNome(e.target.value)}
            placeholder="Marido pra Quê"
          />
          <p className="text-[11px] text-slate-500">
            Usado na variável <code className="px-1 bg-slate-100 rounded">{"{{marca}}"}</code>.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Assinatura
          </label>
          <Input
            value={assinatura}
            onChange={(e) => setAssinatura(e.target.value)}
            placeholder="Equipe Marido pra Quê"
          />
          <p className="text-[11px] text-slate-500">
            Variável <code className="px-1 bg-slate-100 rounded">{"{{assinatura}}"}</code>.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            <h4 className="font-bold text-sm text-slate-900">Mensagens padrão do WhatsApp</h4>
          </div>
          <Button variant="outline" size="sm" onClick={addTemplate}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo modelo
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          Variáveis disponíveis: <code className="px-1 bg-slate-100 rounded">{"{{nome}}"}</code>,{" "}
          <code className="px-1 bg-slate-100 rounded">{"{{marca}}"}</code>,{" "}
          <code className="px-1 bg-slate-100 rounded">{"{{assinatura}}"}</code>.
        </p>

        {templates.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-2xl text-sm text-slate-500">
            Nenhum modelo cadastrado.
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t, idx) => (
              <div key={t.id || idx} className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <Input
                    value={t.titulo}
                    onChange={(e) => updateTemplate(idx, { titulo: e.target.value })}
                    placeholder="Título do modelo (ex.: Cobrança de documentos)"
                    className="font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTemplate(idx)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={t.mensagem}
                  onChange={(e) => updateTemplate(idx, { mensagem: e.target.value })}
                  placeholder="Olá {{nome}}, aqui é da {{marca}}..."
                  rows={3}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
