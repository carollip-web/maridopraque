import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileDown, FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminServicos() {
  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ["admin", "servicos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services_catalog")
        .select("*")
        .order("categoria")
        .order("nome");
      return data || [];
    },
  });

  const categorias = useMemo(() => {
    const map: Record<string, number> = {};
    servicos.forEach((s: any) => {
      map[s.categoria] = (map[s.categoria] || 0) + 1;
    });
    return Object.entries(map);
  }, [servicos]);

  const qc = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = () => {
    if (servicos.length === 0) return;
    const headers = [
      "id",
      "nome",
      "categoria",
      "descricao",
      "is_fixed_price",
      "preco_fixo",
      "preco_min",
      "preco_max",
      "ativo",
    ];
    const rows = servicos.map((s: any) =>
      headers
        .map((h) => {
          const val = s[h];
          if (val === null || val === undefined) return "";
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `catalogo_servicos_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new Error("Arquivo vazio ou sem dados");

        const headers = lines[0]
          .split(",")
          .map((h) => h.replace(/"/g, "").trim());
        const data = lines
          .slice(1)
          .map((line) => {
            const values: string[] = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') inQuotes = !inQuotes;
              else if (char === "," && !inQuotes) {
                values.push(current);
                current = "";
              } else current += char;
            }
            values.push(current);

            const obj: any = {};
            headers.forEach((h, i) => {
              let val: any =
                values[i]?.replace(/^"|"$/g, "").replace(/""/g, '"') || null;
              if (["preco_fixo", "preco_min", "preco_max"].includes(h)) {
                val = val ? Number(val) : null;
              } else if (h === "is_fixed_price" || h === "ativo") {
                val =
                  val?.toLowerCase() === "true" ||
                  val === "Sim" ||
                  val === "1";
              }
              if (h === "id" && !val) return;
              obj[h] = val;
            });
            return obj;
          })
          .filter((item) => item.nome);

        const { error } = await supabase.from("services_catalog").upsert(data);
        if (error) throw error;

        toast.success("Catálogo importado!", {
          description: `${data.length} serviços atualizados.`,
        });
        qc.invalidateQueries({ queryKey: ["admin", "servicos"] });
      } catch (err: any) {
        toast.error("Erro na importação", { description: err.message });
      } finally {
        setIsImporting(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Catálogo de Serviços</h2>
          <p className="text-sm text-slate-500">
            Exporte ou importe a tabela para edições em massa no Excel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="rounded-xl gap-2 h-10 px-4 bg-white"
          >
            <FileDown className="h-4 w-4" /> Exportar CSV
          </Button>

          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
              id="csv-import"
              disabled={isImporting}
            />
            <label htmlFor="csv-import">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl gap-2 h-10 px-4 bg-white cursor-pointer"
              >
                <span>
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  Importar CSV
                </span>
              </Button>
            </label>
          </div>

          <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block" />

          <Link to="/materiais-admin">
            <Button variant="outline" className="rounded-xl h-10 px-4 bg-white">
              Materiais
            </Button>
          </Link>
          <Link to="/servicos-admin">
            <Button className="bg-brand text-white rounded-xl h-10 px-4 font-bold">
              Gerenciar serviços
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading &&
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2"
            >
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        {!isLoading &&
          categorias.map(([cat, count]) => (
            <div
              key={cat}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"
            >
              <p className="font-bold capitalize">{cat}</p>
              <p className="text-xs text-slate-500">
                {count} {count === 1 ? "item ativo" : "itens ativos"}
              </p>
            </div>
          ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            <tr>
              <th className="px-6 py-4">Serviço</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Faixa de preço</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading &&
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-48" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Skeleton className="h-5 w-16 ml-auto rounded-full" />
                  </td>
                </tr>
              ))}
            {!isLoading && servicos.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-slate-400 text-sm"
                >
                  Nenhum serviço cadastrado.
                </td>
              </tr>
            )}
            {!isLoading &&
              servicos.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-bold">{s.nome}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 capitalize">
                    {s.categoria}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold">
                    {s.preco_min != null && s.preco_max != null
                      ? `R$ ${Number(s.preco_min).toFixed(0)} – R$ ${Number(s.preco_max).toFixed(0)}`
                      : s.preco_fixo != null
                        ? `R$ ${Number(s.preco_fixo).toFixed(2)}`
                        : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${s.ativo ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-400"}`}
                    >
                      {s.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
