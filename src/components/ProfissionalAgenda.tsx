import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Calendar, Clock, Ban } from "lucide-react";
import { DIAS_SEMANA, type Janela } from "@/lib/agenda";
import { AgendaCalendar } from "@/components/AgendaCalendar";

type Bloqueio = { id: string; data_inicio: string; data_fim: string; motivo: string | null };
type JanelaRow = Janela & { id: string };

const EMPTY_JANELAS: JanelaRow[] = [];
const EMPTY_BLOQS: Bloqueio[] = [];

export function ProfissionalAgenda() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const [duracao, setDuracao] = useState(60);

  // form janela
  const [diaSel, setDiaSel] = useState(1);
  const [horaIni, setHoraIni] = useState("08:00");
  const [horaFim, setHoraFim] = useState("18:00");

  // form bloqueio
  const [bIni, setBIni] = useState("");
  const [bFim, setBFim] = useState("");
  const [bMotivo, setBMotivo] = useState("");

  const agendaQuery = useQuery({
    queryKey: ["profissional", "agenda-config", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: jans }, { data: blocs }, { data: perfil }] = await Promise.all([
        supabase
          .from("profissional_disponibilidade")
          .select("*")
          .eq("user_id", userId!)
          .order("dia_semana")
          .order("hora_inicio"),
        supabase
          .from("profissional_bloqueios")
          .select("*")
          .eq("user_id", userId!)
          .order("data_inicio"),
        supabase
          .from("profissional_perfil")
          .select("duracao_padrao_min")
          .eq("user_id", userId!)
          .maybeSingle(),
      ]);
      return {
        janelas: (jans as JanelaRow[]) ?? EMPTY_JANELAS,
        bloqueios: (blocs as Bloqueio[]) ?? EMPTY_BLOQS,
        duracao: perfil?.duracao_padrao_min ?? 60,
      };
    },
  });

  const janelas = agendaQuery.data?.janelas ?? EMPTY_JANELAS;
  const bloqueios = agendaQuery.data?.bloqueios ?? EMPTY_BLOQS;
  const loading = agendaQuery.isLoading;

  // Sincroniza duracao do form com o servidor quando carrega
  useEffect(() => {
    if (agendaQuery.data) setDuracao(agendaQuery.data.duracao);
  }, [agendaQuery.data]);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["profissional", "agenda-config", userId],
    });

  const addJanelaMut = useMutation({
    mutationFn: async () => {
      if (!userId || horaFim <= horaIni) throw new Error("Horário final deve ser maior que o inicial.");
      const { error } = await supabase.from("profissional_disponibilidade").insert({
        user_id: userId,
        dia_semana: diaSel,
        hora_inicio: horaIni,
        hora_fim: horaFim,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Janela adicionada");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro ao adicionar", { description: e?.message }),
  });

  const removerJanelaMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profissional_disponibilidade").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error("Erro", { description: e?.message }),
  });

  const addBloqueioMut = useMutation({
    mutationFn: async () => {
      if (!userId || !bIni || !bFim) throw new Error("Preencha início e fim do bloqueio.");
      if (new Date(bFim) <= new Date(bIni)) throw new Error("Fim deve ser posterior ao início.");
      const { error } = await supabase.from("profissional_bloqueios").insert({
        user_id: userId,
        data_inicio: bIni,
        data_fim: bFim,
        motivo: bMotivo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBIni("");
      setBFim("");
      setBMotivo("");
      toast.success("Bloqueio criado");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro", { description: e?.message }),
  });

  const removerBloqueioMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profissional_bloqueios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error("Erro", { description: e?.message }),
  });

  const addJanela = () => addJanelaMut.mutate();
  const removerJanela = (id: string) => removerJanelaMut.mutate(id);
  const addBloqueio = () => addBloqueioMut.mutate();
  const removerBloqueio = (id: string) => removerBloqueioMut.mutate(id);

  const salvarDuracao = async (val: number) => {
    if (!userId) return;
    setDuracao(val);
    await supabase
      .from("profissional_perfil")
      .update({ duracao_padrao_min: val })
      .eq("user_id", userId);
    invalidate();
  };

  if (loading) {
    return (
      <div className="py-24 grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Agenda & disponibilidade
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Defina seus horários de atendimento e bloqueios. Clientes só conseguem agendar nos slots
          disponíveis.
        </p>
      </div>

      <AgendaCalendar />

      <section className="rounded-3xl bg-white border border-border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-bold text-slate-900">Duração padrão de atendimento</h3>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={15}
            max={480}
            step={15}
            value={duracao}
            onChange={(e) => setDuracao(Number(e.target.value))}
            onBlur={(e) => salvarDuracao(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">minutos por slot</span>
        </div>
      </section>

      <section className="rounded-3xl bg-white border border-border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-bold text-slate-900">Horários semanais</h3>
        </div>

        <div className="grid sm:grid-cols-4 gap-2 mb-4 items-end">
          <div>
            <Label className="text-xs">Dia</Label>
            <select
              value={diaSel}
              onChange={(e) => setDiaSel(Number(e.target.value))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {DIAS_SEMANA.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Início</Label>
            <Input type="time" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
          </div>
          <Button
            onClick={addJanela}
            className="bg-brand hover:bg-brand-700 text-white rounded-full"
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        {janelas.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhuma janela cadastrada. Adicione ao menos um dia para começar a receber agendamentos.
          </p>
        ) : (
          <div className="space-y-1">
            {DIAS_SEMANA.map((nome, i) => {
              const doDia = janelas.filter((j) => j.dia_semana === i);
              if (doDia.length === 0) return null;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0"
                >
                  <span className="w-12 text-xs font-bold uppercase text-slate-700">{nome}</span>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {doDia.map((j) => (
                      <span
                        key={j.id}
                        className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-medium"
                      >
                        {j.hora_inicio.slice(0, 5)}–{j.hora_fim.slice(0, 5)}
                        <button onClick={() => removerJanela(j.id)} className="hover:text-rose-600">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white border border-border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Ban className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-bold text-slate-900">
            Bloqueios (férias, indisponibilidade)
          </h3>
        </div>

        <div className="grid sm:grid-cols-4 gap-2 mb-4 items-end">
          <div>
            <Label className="text-xs">Início</Label>
            <Input type="datetime-local" value={bIni} onChange={(e) => setBIni(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="datetime-local" value={bFim} onChange={(e) => setBFim(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Motivo (opcional)</Label>
            <Input
              value={bMotivo}
              onChange={(e) => setBMotivo(e.target.value)}
              placeholder="Férias, evento…"
            />
          </div>
          <Button onClick={addBloqueio} variant="outline" className="rounded-full">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        {bloqueios.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhum bloqueio cadastrado.
          </p>
        ) : (
          <div className="space-y-2">
            {bloqueios.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-100"
              >
                <div className="text-xs">
                  <p className="font-bold text-rose-900">
                    {new Date(b.data_inicio).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}{" "}
                    →{" "}
                    {new Date(b.data_fim).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                  {b.motivo && <p className="text-rose-700 mt-0.5">{b.motivo}</p>}
                </div>
                <button
                  onClick={() => removerBloqueio(b.id)}
                  className="text-rose-500 hover:text-rose-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
