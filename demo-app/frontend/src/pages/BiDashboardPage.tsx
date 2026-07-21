// Modul BI — Scenariul 2: dashboard-uri analitice (date reale din DmsRequest/User,
// nu simulate) + interogare în limbaj natural (NL2SQL) + rapoarte salvate reutilizabile.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock3, CheckCircle2, Info } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import { AppShell } from "../components/AppShell";
import { Card, Button, SectionHeader, Pill, Skeleton } from "../components/ui";
import { CalendarHeatmap } from "../components/CalendarHeatmap";
import { T } from "../theme";
import {
  fetchComplianceDashboard,
  fetchDocumentsDashboard,
  fetchWorkloadDashboard,
  runNl2SqlQuery,
  fetchSavedReports,
  saveReport,
  fetchSavedReportData,
  deleteSavedReport,
  fetchAlertMetrics,
  fetchAlertRules,
  createAlertRule,
  deleteAlertRule,
  fetchScoresDashboard,
  ScoresDashboardDto,
  ComplianceDashboardDto,
  DocumentsDashboardDto,
  WorkloadDashboardDto,
  Nl2SqlResultDto,
  BiSavedReportDto,
  KpiTone,
  AlertMetricDto,
  BiAlertRuleDto,
  AlertOperator,
} from "../features/bi/api";

const TONE_STYLE: Record<KpiTone, { color: string; bg: string }> = {
  success: { color: T.success, bg: T.successTint },
  warn: { color: T.warn, bg: T.warnTint },
  danger: { color: T.danger, bg: T.dangerTint },
  info: { color: T.info, bg: T.infoTint },
};

const TONE_ICON: Record<KpiTone, typeof AlertTriangle> = {
  danger: AlertTriangle,
  warn: Clock3,
  success: CheckCircle2,
  info: Info,
};

const PIE_COLORS = [T.brand, T.info, T.success, T.warn, T.danger, T.progress, "#0EA5E9", "#DB2777"];

// Numărul KPI-ului "numără" de la 0 la valoare la montare/schimbare de tab — polish
// pur vizual, fără date fabricate (vezi nota de scop din planul acestei schimbări).
function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof target !== "number" || Number.isNaN(target)) return;
    let frame: number;
    let start: number | null = null;
    function tick(now: number) {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(progress * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

const kpiContainerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const kpiItemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

function KpiCard({ label, value, tone }: { label: string; value: number | string; tone: KpiTone }) {
  const style = TONE_STYLE[tone] || TONE_STYLE.info;
  const Icon = TONE_ICON[tone] || Info;
  const animated = useCountUp(typeof value === "number" ? value : 0);
  return (
    <motion.div variants={kpiItemVariants} style={{ flex: 1, minWidth: 160 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
          <Icon size={15} color={style.color} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: style.color }}>{typeof value === "number" ? animated : value}</div>
      </Card>
    </motion.div>
  );
}

// Rând de KPI-uri cu intrare eșalonată (fiecare card apare cu o mică întârziere
// secvențială) — înlocuiește `<div>{kpis.map(...)}</div>` repetat identic în fiecare tab.
function KpiRow({ kpis }: { kpis: { label: string; value: number | string; tone: KpiTone }[] }) {
  return (
    <motion.div variants={kpiContainerVariants} initial="hidden" animate="show" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
      {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
    </motion.div>
  );
}

// Placeholder de încărcare — formă aproximativă a conținutului final (rând de KPI +
// bloc de grafic), în loc de textul simplu "Se încarcă...".
function BiTabSkeleton() {
  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} style={{ flex: 1, minWidth: 160 }}>
            <Skeleton width={90} height={11} style={{ marginBottom: 12 }} />
            <Skeleton width={60} height={26} />
          </Card>
        ))}
      </div>
      <Card style={{ marginBottom: 20 }}>
        <Skeleton width={180} height={12} style={{ marginBottom: 18 }} />
        <Skeleton height={220} borderRadius={12} />
      </Card>
    </div>
  );
}

function BarChartCard({ title, data, xKey, yKey }: { title?: string; data: any[]; xKey: string; yKey: string }) {
  return (
    <Card style={{ marginBottom: 20 }}>
      {title && <SectionHeader title={title} />}
      {data.length === 0 ? (
        <p style={{ color: T.ink3, fontSize: 13 }}>Nicio dată disponibilă încă.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: T.ink3 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: T.ink3 }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12 }} />
            <Bar dataKey={yKey} fill={T.brand} radius={[6, 6, 0, 0]} animationDuration={700} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function LineChartCard({ title, data, xKey, yKey }: { title?: string; data: any[]; xKey: string; yKey: string }) {
  const gradientId = `lineGradient-${xKey}-${yKey}`;
  return (
    <Card style={{ marginBottom: 20 }}>
      {title && <SectionHeader title={title} />}
      {data.length === 0 ? (
        <p style={{ color: T.ink3, fontSize: 13 }}>Nicio dată disponibilă încă.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={T.brand} stopOpacity={0.35} />
                <stop offset="95%" stopColor={T.brand} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: T.ink3 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: T.ink3 }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12 }} />
            <Area type="monotone" dataKey={yKey} stroke={T.brand} strokeWidth={2.5} fill={`url(#${gradientId})`} dot={{ r: 3 }} animationDuration={700} animationEasing="ease-out" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function PieChartCard({ title, data, nameKey, valueKey }: { title?: string; data: any[]; nameKey: string; valueKey: string }) {
  return (
    <Card style={{ marginBottom: 20 }}>
      {title && <SectionHeader title={title} />}
      {data.length === 0 ? (
        <p style={{ color: T.ink3, fontSize: 13 }}>Nicio dată disponibilă încă.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={90} label={(d: any) => `${d[nameKey]}: ${d[valueKey]}`} animationDuration={700} animationEasing="ease-out">
              {data.map((_, idx) => (
                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function RadarChartCard({ title, data, metricKey, valueKey, domain = [0, 100] }: { title?: string; data: any[]; metricKey: string; valueKey: string; domain?: [number, number] }) {
  return (
    <Card style={{ marginBottom: 20 }}>
      {title && <SectionHeader title={title} />}
      {data.length === 0 ? (
        <p style={{ color: T.ink3, fontSize: 13 }}>Nicio dată disponibilă încă.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={data}>
            <PolarGrid stroke={T.line} />
            <PolarAngleAxis dataKey={metricKey} tick={{ fontSize: 11, fill: T.ink3 }} />
            <PolarRadiusAxis angle={30} domain={domain} tick={{ fontSize: 10, fill: T.ink4 }} />
            <Radar dataKey={valueKey} stroke={T.brand} fill={T.brand} fillOpacity={0.35} animationDuration={700} animationEasing="ease-out" />
            <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12 }} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function FunnelChartCard({ title, data, nameKey, valueKey }: { title?: string; data: any[]; nameKey: string; valueKey: string }) {
  return (
    <Card style={{ marginBottom: 20 }}>
      {title && <SectionHeader title={title} />}
      {data.length === 0 ? (
        <p style={{ color: T.ink3, fontSize: 13 }}>Nicio dată disponibilă încă.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <FunnelChart>
            <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12 }} />
            <Funnel dataKey={valueKey} data={data} nameKey={nameKey} isAnimationActive animationDuration={700} animationEasing="ease-out">
              {data.map((_, idx) => (
                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
              ))}
              <LabelList dataKey={nameKey} position="right" fill={T.ink2} stroke="none" fontSize={11} />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// Scoruri avansate (cerință 4.5.12) — Efficiency/Delay/Throughput/Approval Quality,
// comparate pe un Radar, plus Donut/Funnel/Calendar Heatmap ca grafice de sprijin.
function ScoresTab() {
  const [data, setData] = useState<ScoresDashboardDto | null>(null);
  useEffect(() => {
    fetchScoresDashboard().then(setData).catch(() => setData(null));
  }, []);
  if (!data) return <BiTabSkeleton />;

  const radarData = [
    { metric: "Efficiency", value: data.efficiency },
    { metric: "Throughput", value: data.throughput },
    { metric: "Approval Quality", value: data.approvalQuality },
    // Delay e "mai mic = mai bine" — inversăm pe o scală 0-100 ca să se citească coerent pe radar.
    { metric: "Delay (invers)", value: Math.max(0, 100 - data.delay * 5) },
  ];

  return (
    <div>
      <KpiRow
        kpis={[
          { label: "Efficiency", value: `${data.efficiency}%`, tone: data.efficiency >= 70 ? "success" : "warn" },
          { label: "Delay mediu", value: `${data.delay} zile`, tone: data.delay === 0 ? "success" : "warn" },
          { label: "Throughput", value: `${data.throughput}%`, tone: data.throughput >= 50 ? "success" : "info" },
          { label: "Approval Quality", value: `${data.approvalQuality}%`, tone: data.approvalQuality >= 70 ? "success" : "danger" },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <RadarChartCard title="Radar scoruri" data={radarData} metricKey="metric" valueKey="value" />

        <Card>
          <SectionHeader title="Distribuție status (Donut)" />
          {data.byStatus.length === 0 ? (
            <p style={{ color: T.ink3, fontSize: 13 }}>Nicio dată disponibilă încă.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                  {data.byStatus.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <FunnelChartCard title="Progresia cererilor (Funnel)" data={data.funnel} nameKey="stage" valueKey="count" />

        <LineChartCard title="Throughput lunar (cereri închise)" data={data.throughputTrend} xKey="label" yKey="count" />
      </div>

      <Card>
        <SectionHeader title={`Volum zilnic ${new Date().getFullYear()} (Calendar Heatmap)`} />
        <CalendarHeatmap data={data.dailyVolume} year={new Date().getFullYear()} />
      </Card>
    </div>
  );
}

function ComplianceTab() {
  const [data, setData] = useState<ComplianceDashboardDto | null>(null);
  useEffect(() => {
    fetchComplianceDashboard().then(setData).catch(() => setData(null));
  }, []);
  if (!data) return <BiTabSkeleton />;
  return (
    <div>
      <KpiRow kpis={data.kpis} />
      <BarChartCard title="Cereri întârziate pe categorie" data={data.overdueByCategory} xKey="category" yKey="count" />
      <LineChartCard title="Volum de cereri înregistrate (ultimele 6 luni)" data={data.volumeTrend} xKey="label" yKey="count" />
    </div>
  );
}

function DocumentsTab() {
  const [data, setData] = useState<DocumentsDashboardDto | null>(null);
  useEffect(() => {
    fetchDocumentsDashboard().then(setData).catch(() => setData(null));
  }, []);
  if (!data) return <BiTabSkeleton />;
  return (
    <div>
      <KpiRow kpis={data.kpis} />
      <PieChartCard title="Distribuția pe status" data={data.byStatus} nameKey="status" valueKey="count" />
      <BarChartCard title="Distribuția pe categorie" data={data.byCategory} xKey="category" yKey="count" />
      <LineChartCard title="Volum de cereri în timp" data={data.volumeTrend} xKey="label" yKey="count" />
    </div>
  );
}

function WorkloadTab() {
  const [data, setData] = useState<WorkloadDashboardDto | null>(null);
  useEffect(() => {
    fetchWorkloadDashboard().then(setData).catch(() => setData(null));
  }, []);
  if (!data) return <BiTabSkeleton />;
  return (
    <div>
      <KpiRow kpis={data.kpis} />
      <BarChartCard title="Volum de lucru pe utilizator" data={data.byUser} xKey="name" yKey="count" />
      <BarChartCard title="Volum de lucru pe grup" data={data.byGroup} xKey="name" yKey="count" />
    </div>
  );
}

function ResultRenderer({ result }: { result: Nl2SqlResultDto }) {
  if (!result.matched) {
    return (
      <div>
        <p style={{ color: T.ink3, fontSize: 13 }}>{result.explanation}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {result.suggestions?.map((s) => (
            <Pill key={s} style={{ alignSelf: "flex-start" }}>{s}</Pill>
          ))}
        </div>
      </div>
    );
  }
  const [nameKey, valueKey] = result.columns;
  return (
    <div>
      <p style={{ fontSize: 13, color: T.ink2, marginBottom: 10 }}>{result.explanation}</p>
      {result.chartType === "BAR" && <BarChartCard title="" data={result.rows} xKey={nameKey} yKey={valueKey} />}
      {result.chartType === "LINE" && <LineChartCard title="" data={result.rows} xKey={nameKey} yKey={valueKey} />}
      {result.chartType === "PIE" && <PieChartCard title="" data={result.rows} nameKey={nameKey} valueKey={valueKey} />}
      {result.chartType === "FUNNEL" && <FunnelChartCard title="" data={result.rows} nameKey={nameKey} valueKey={valueKey} />}
      {(result.chartType === "TABLE" || result.chartType === "KPI") && (
        <table style={{ width: "100%" }}>
          <thead>
            <tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {result.rows.map((r, idx) => (
              <tr key={idx}>{result.columns.map((c) => <td key={c}>{String(r[c])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
      <details style={{ marginTop: 12 }}>
        <summary style={{ fontSize: 12, color: T.ink3, cursor: "pointer" }}>SQL generat (transparență mecanism)</summary>
        <pre style={{ fontSize: 12, background: T.line2, padding: 10, borderRadius: 8, whiteSpace: "pre-wrap", marginTop: 6 }}>{result.sqlPreview}</pre>
      </details>
    </div>
  );
}

function QueriesTab() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Nl2SqlResultDto | null>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [savedReports, setSavedReports] = useState<BiSavedReportDto[]>([]);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [openReportResult, setOpenReportResult] = useState<Nl2SqlResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loadReports() {
    fetchSavedReports().then(setSavedReports).catch(() => setSavedReports([]));
  }
  useEffect(loadReports, []);

  async function handleAsk() {
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await runNl2SqlQuery(question);
      setResult(res);
      setReportTitle(res.title);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Interogarea a eșuat");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!result?.matched || !result.intentKey) return;
    try {
      await saveReport({
        title: reportTitle || result.title,
        questionText: question,
        intentKey: result.intentKey,
        params: result.params,
        chartType: result.chartType,
      });
      loadReports();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut salva raportul");
    }
  }

  async function toggleReport(id: string) {
    if (openReportId === id) {
      setOpenReportId(null);
      setOpenReportResult(null);
      return;
    }
    const full = await fetchSavedReportData(id);
    setOpenReportId(id);
    setOpenReportResult(full.result);
  }

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Interogare în limbaj natural (NL2SQL)" />
        <p style={{ fontSize: 12, color: T.ink3, marginBottom: 10 }}>
          Pune o întrebare în română despre cereri, termene, statusuri sau volum de lucru — sistemul potrivește întrebarea cu o interogare predefinită, o rulează pe date reale și afișează SQL-ul echivalent generat.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="ex: Care categorie are cele mai multe întârzieri?"
            style={{ flex: 1 }}
          />
          <Button id="bi-query-btn" onClick={handleAsk}>{busy ? "Se caută..." : "Interoghează"}</Button>
        </div>
        {error && <p style={{ color: T.danger, fontSize: 12 }}>{error}</p>}
        {result && (
          <div style={{ padding: 14, background: T.bgSoft, borderRadius: 12 }}>
            <ResultRenderer result={result} />
            {result.matched && (
              <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
                <input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder="Titlu raport" style={{ flex: 1 }} />
                <Button id="bi-save-report-btn" variant="ghost" onClick={handleSave}>Salvează în Rapoarte</Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <SectionHeader title={`Rapoarte salvate (${savedReports.length})`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {savedReports.map((r) => (
          <Card key={r.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{r.title}</div>
                {r.questionText && <div style={{ fontSize: 12, color: T.ink3 }}>„{r.questionText}”</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => toggleReport(r.id)}>
                  {openReportId === r.id ? "Ascunde" : "Vezi date live"}
                </Button>
                <Button
                  variant="danger"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={async () => {
                    await deleteSavedReport(r.id);
                    loadReports();
                  }}
                >
                  Șterge
                </Button>
              </div>
            </div>
            {openReportId === r.id && openReportResult && (
              <div style={{ marginTop: 14 }}>
                <ResultRenderer result={openReportResult} />
              </div>
            )}
          </Card>
        ))}
        {savedReports.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun raport salvat încă.</p>}
      </div>
    </div>
  );
}

const OPERATOR_LABELS: Record<AlertOperator, string> = { GT: "peste", GTE: "peste sau egal cu", LT: "sub", LTE: "sub sau egal cu" };

// Alerte pe prag — regulă simplă peste un indicator existent (metrics.ts), evaluată
// LIVE la fiecare deschidere a tabului (fără scheduler în acest demo, ca peste tot).
function AlertsTab() {
  const [metrics, setMetrics] = useState<AlertMetricDto[]>([]);
  const [rules, setRules] = useState<BiAlertRuleDto[]>([]);
  const [draft, setDraft] = useState({ label: "", metricKey: "", operator: "GT" as AlertOperator, threshold: "0" });
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchAlertMetrics().then(setMetrics).catch(() => setMetrics([]));
    fetchAlertRules().then(setRules).catch(() => setRules([]));
  }
  useEffect(load, []);

  async function handleCreate() {
    if (!draft.label.trim() || !draft.metricKey) return;
    setError(null);
    try {
      await createAlertRule({ label: draft.label, metricKey: draft.metricKey, operator: draft.operator, threshold: Number(draft.threshold) || 0 });
      setDraft({ label: "", metricKey: "", operator: "GT", threshold: "0" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut crea alerta");
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Alertă nouă" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Nume alertă (ex. Prea multe restanțe)" style={{ width: "100%" }} />
          </div>
          <select value={draft.metricKey} onChange={(e) => setDraft({ ...draft, metricKey: e.target.value })} style={{ flex: 2, minWidth: 200 }}>
            <option value="">Alege indicatorul...</option>
            {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <select value={draft.operator} onChange={(e) => setDraft({ ...draft, operator: e.target.value as AlertOperator })}>
            {Object.entries(OPERATOR_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: e.target.value })} style={{ width: 90 }} />
          <Button id="bi-create-alert-btn" onClick={handleCreate}>Creează</Button>
        </div>
        {error && <p style={{ color: T.danger, fontSize: 12.5, marginTop: 8 }}>{error}</p>}
      </Card>

      <SectionHeader title={`${rules.length} alerte configurate`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rules.map((r) => (
          <Card key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.label}</div>
              <div style={{ fontSize: 12.5, color: T.ink3, marginTop: 2 }}>
                {metrics.find((m) => m.key === r.metricKey)?.label || r.metricKey} {OPERATOR_LABELS[r.operator]} {r.threshold} — valoare curentă: {r.currentValue ?? "—"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {r.triggered ? (
                <Pill color={T.danger} bg={T.dangerTint}>Declanșată</Pill>
              ) : (
                <Pill color={T.success} bg={T.successTint}>OK</Pill>
              )}
              <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => deleteAlertRule(r.id).then(load)}>Șterge</Button>
            </div>
          </Card>
        ))}
        {rules.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Nicio alertă configurată încă.</p>}
      </div>
    </div>
  );
}

const TABS = [
  { key: "compliance", label: "Conformitate / Termene" },
  { key: "documents", label: "Flux documente" },
  { key: "workload", label: "Volum de lucru" },
  { key: "scores", label: "Scoruri avansate" },
  { key: "queries", label: "Interogări & Rapoarte" },
  { key: "alerts", label: "Alerte" },
] as const;

export default function BiDashboardPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("compliance");

  return (
    <AppShell title="Business Intelligence" subtitle="Dashboard-uri analitice, interogare în limbaj natural și rapoarte reutilizabile — date reale din registratură">
      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: `1px solid ${T.line}`, paddingBottom: 4 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            id={`bi-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{
              border: "none",
              background: "none",
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              color: tab === t.key ? T.brand : T.ink3,
              borderBottom: tab === t.key ? `2px solid ${T.brand}` : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "compliance" && <ComplianceTab />}
      {tab === "documents" && <DocumentsTab />}
      {tab === "workload" && <WorkloadTab />}
      {tab === "scores" && <ScoresTab />}
      {tab === "queries" && <QueriesTab />}
      {tab === "alerts" && <AlertsTab />}
    </AppShell>
  );
}
