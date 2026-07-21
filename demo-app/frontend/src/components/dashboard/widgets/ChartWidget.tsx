import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { T } from "../../../theme";
import { fetchComplianceDashboard, fetchDocumentsDashboard, fetchWorkloadDashboard, KpiDto } from "../../../features/bi/api";

type Source = "compliance" | "documents" | "workload";

interface Loaded {
  kpis: KpiDto[];
  bars: { label: string; count: number }[];
}

async function loadSource(source: Source): Promise<Loaded> {
  if (source === "compliance") {
    const d = await fetchComplianceDashboard();
    return { kpis: d.kpis, bars: d.overdueByCategory.map((r) => ({ label: r.category, count: r.count })) };
  }
  if (source === "workload") {
    const d = await fetchWorkloadDashboard();
    return { kpis: d.kpis, bars: d.byUser.map((r) => ({ label: r.name, count: r.count })) };
  }
  const d = await fetchDocumentsDashboard();
  return { kpis: d.kpis, bars: d.byStatus.map((r) => ({ label: r.status, count: r.count })) };
}

export function ChartWidget({ config }: { config?: Record<string, unknown> | null }) {
  const source = (config?.source as Source) || "documents";
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSource(source)
      .then(setData)
      .catch(() => setError("Nu ai acces la datele BI."));
  }, [source]);

  if (error) return <div style={{ color: T.ink3, fontSize: 13 }}>{error}</div>;
  if (!data) return <div style={{ color: T.ink3, fontSize: 13 }}>Se încarcă...</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        {data.kpis.slice(0, 2).map((k) => (
          <div key={k.label}>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.ink, fontFamily: "var(--font-display)" }}>{k.value}</div>
            <div style={{ fontSize: 10.5, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ width: "100%", height: 110 }}>
        <ResponsiveContainer>
          <BarChart data={data.bars.slice(0, 6)}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.ink3 }} interval={0} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: T.line2 }} />
            <Bar dataKey="count" fill={T.brand} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
