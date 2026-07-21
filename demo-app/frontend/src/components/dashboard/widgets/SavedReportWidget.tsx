import { useEffect, useState } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { T } from "../../../theme";
import { fetchSavedReportData, BiSavedReportDto, Nl2SqlResultDto } from "../../../features/bi/api";

const PIE_COLORS = [T.brand, T.info, T.progress, T.warn, T.success, T.danger];

export function SavedReportWidget({ config }: { config?: Record<string, unknown> | null }) {
  const reportId = config?.reportId as string | undefined;
  const [report, setReport] = useState<(BiSavedReportDto & { result: Nl2SqlResultDto }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) {
      setError("Raport nesetat.");
      return;
    }
    fetchSavedReportData(reportId)
      .then(setReport)
      .catch(() => setError("Raportul nu mai există sau nu ai acces."));
  }, [reportId]);

  if (error) return <div style={{ color: T.ink3, fontSize: 13 }}>{error}</div>;
  if (!report) return <div style={{ color: T.ink3, fontSize: 13 }}>Se încarcă...</div>;

  const { result } = report;
  const [nameKey, valueKey] = result.columns;

  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.ink3, marginBottom: 8 }}>{report.title}</div>
      {result.chartType === "BAR" && (
        <div style={{ width: "100%", height: 110 }}>
          <ResponsiveContainer>
            <BarChart data={result.rows.slice(0, 6)}>
              <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: T.ink3 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: T.line2 }} />
              <Bar dataKey={valueKey} fill={T.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {result.chartType === "PIE" && (
        <div style={{ width: "100%", height: 130 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={result.rows.slice(0, 6)} dataKey={valueKey} nameKey={nameKey} outerRadius={50}>
                {result.rows.slice(0, 6).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {(result.chartType === "TABLE" || result.chartType === "KPI" || result.chartType === "LINE") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {result.rows.slice(0, 6).map((r, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: T.ink2 }}>{String(r[nameKey])}</span>
              <span style={{ fontWeight: 700, color: T.ink }}>{String(r[valueKey])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
