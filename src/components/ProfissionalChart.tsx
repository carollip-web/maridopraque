import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type Orc = {
  status: string;
  valor: number | null;
  created_at: string;
  updated_at: string;
  data_pagamento?: string | null;
  profissional_id: string | null;
};

const WEEKS = 8;

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // segunda = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function fmtLabel(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ProfissionalChart({
  orcamentos,
  userId,
}: {
  orcamentos: Orc[];
  userId: string | undefined;
}) {
  const data = useMemo(() => {
    const now = new Date();
    const weeks: { start: Date; end: Date; label: string }[] = [];
    const base = startOfWeek(now);
    for (let i = WEEKS - 1; i >= 0; i--) {
      const start = new Date(base);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      weeks.push({ start, end, label: fmtLabel(start) });
    }

    const meus = orcamentos.filter((o) => o.profissional_id === userId);

    return weeks.map(({ start, end, label }) => {
      const inWeek = (iso: string) => {
        const t = new Date(iso).getTime();
        return t >= start.getTime() && t < end.getTime();
      };

      const ganhos = meus
        .filter(
          (o) =>
            (o.status === "pago" || o.status === "concluido") &&
            inWeek(o.data_pagamento ?? o.updated_at),
        )
        .reduce((acc, o) => acc + Number(o.valor || 0), 0);

      const enviadosNaSemana = meus.filter(
        (o) =>
          ["enviado", "aprovado", "pago", "concluido", "recusado"].includes(o.status) &&
          inWeek(o.updated_at),
      );
      const aceitas = enviadosNaSemana.filter((o) => o.status !== "recusado");
      const taxa =
        enviadosNaSemana.length > 0
          ? Math.round((aceitas.length / enviadosNaSemana.length) * 100)
          : 0;

      return {
        semana: label,
        ganhos: Number(ganhos.toFixed(2)),
        taxa,
      };
    });
  }, [orcamentos, userId]);

  const totalGanhos = data.reduce((acc, d) => acc + d.ganhos, 0);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Evolução semanal
          </p>
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            Ganhos e taxa de aceitação
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Últimas {WEEKS} semanas {totalGanhos === 0 ? "— ainda sem dados suficientes" : ""}
          </p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="semana"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `R$${v}`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value: number, name) => {
                if (name === "ganhos") return [`R$ ${value.toFixed(2)}`, "Ganhos"];
                if (name === "taxa") return [`${value}%`, "Aceitação"];
                return [value, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(v) => (v === "ganhos" ? "Ganhos (R$)" : "Aceitação (%)")}
            />
            <Bar
              yAxisId="left"
              dataKey="ganhos"
              fill="hsl(var(--brand, 22 95% 53%))"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="taxa"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
