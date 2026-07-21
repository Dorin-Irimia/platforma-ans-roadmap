// NL2SQL — interogare în limbaj natural (română) → SQL sugerat + rezultat real.
//
// Notă de scop (documentată, nu ascunsă): acesta e un motor semi-automat bazat pe o
// bibliotecă fixă de intenții (nu un LLM care generează SQL arbitrar) — exact varianta
// permisă explicit de cerințe ("acceptă și variante semi-automate, cu explicarea
// mecanismului"). Alegerea e deliberată: a lăsa un model de limbaj să genereze și să
// execute SQL neconstrâns pe baza de date de producție ar fi un risc de injecție/
// exfiltrare fără o infrastructură de sandboxing serioasă, pe care acest demo nu o are.
// În schimb: întrebarea e clasificată contra unei liste fixe de intenții (fiecare cu
// propriile cuvinte-cheie), entitățile relevante (an, grupare) sunt extrase din text,
// iar interogarea efectivă rulează prin Prisma (parametrizat, deci sigur) — stringul SQL
// afișat utilizatorului e doar o reprezentare fidelă, pentru transparență, a ceea ce s-a
// executat, nu SQL brut interpretat direct din întrebare.
import {
  overdueBreakdown,
  countByStatus,
  countByCategory,
  countByDomain,
  volumeTrendByMonth,
  workloadByUser,
  workloadByGroup,
  backlogCount,
  unassignedCount,
  avgResolutionDays,
} from "./metrics";
import { statusFunnel } from "./scores";

export type BiChartType = "TABLE" | "BAR" | "LINE" | "PIE" | "KPI" | "FUNNEL";

export interface Nl2SqlResult {
  matched: boolean;
  intentKey: string | null;
  title: string;
  explanation: string;
  sqlPreview: string;
  chartType: BiChartType;
  columns: string[];
  rows: Record<string, any>[];
  params: Record<string, any>;
  suggestions?: string[];
}

const DIACRITIC_MARKS = /[̀-ͯ]/g;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIC_MARKS, ""); // elimină diacriticele (ă/â/î/ș/ț) pentru potrivire robustă
}

function extractYear(q: string): number | undefined {
  const match = q.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

const GROUP_KEYWORD = { domain: ["domeniu"], category: ["categorie"] };

interface Intent {
  key: string;
  title: string;
  keywords: string[];
  example: string;
  run: (q: string, forcedParams?: Record<string, any>) => Promise<{ columns: string[]; rows: Record<string, any>[]; chartType: BiChartType; params: Record<string, any>; sqlPreview: string; explanation: string; title: string }>;
}

const INTENTS: Intent[] = [
  {
    key: "overdue_breakdown",
    title: "Întârzieri pe categorie/domeniu",
    keywords: ["intarzi", "intarziere", "depasit", "depasire", "restant", "restanta"],
    example: "Care categorie are cele mai multe întârzieri?",
    async run(q, forced) {
      const normalized = normalize(q);
      const groupBy: "category" | "domain" = forced?.groupBy || (GROUP_KEYWORD.domain.some((k) => normalized.includes(k)) ? "domain" : "category");
      const rows = await overdueBreakdown(groupBy);
      return {
        columns: [groupBy === "domain" ? "domeniu" : "categorie", "cereri întârziate"],
        rows: rows.map((r: any) => ({ [groupBy === "domain" ? "domeniu" : "categorie"]: r[groupBy], "cereri întârziate": r.count })),
        chartType: "BAR",
        params: { groupBy },
        sqlPreview: `SELECT ${groupBy}, COUNT(*) FROM "DmsRequest" WHERE status IN ('NOU','IN_LUCRU','IN_ASTEPTARE') AND "legalDeadline" < NOW() GROUP BY ${groupBy} ORDER BY COUNT(*) DESC;`,
        explanation: `Am identificat cererile active (nefinalizate) al căror termen legal a fost depășit și le-am grupat pe ${groupBy === "domain" ? "domeniu" : "categorie"}.`,
        title: `Întârzieri pe ${groupBy === "domain" ? "domeniu" : "categorie"}`,
      };
    },
  },
  {
    key: "status_breakdown",
    title: "Distribuția pe status",
    keywords: ["status", "stare", "distributie"],
    example: "Care este distribuția cererilor pe status?",
    async run() {
      const rows = await countByStatus();
      return {
        columns: ["status", "cereri"],
        rows: rows.map((r) => ({ status: r.status, cereri: r.count })),
        chartType: "PIE",
        params: {},
        sqlPreview: `SELECT status, COUNT(*) FROM "DmsRequest" GROUP BY status;`,
        explanation: "Am numărat cererile pentru fiecare status posibil (Nou, În lucru, În așteptare, Finalizat, Respins).",
        title: "Distribuția pe status",
      };
    },
  },
  {
    key: "status_funnel",
    title: "Progresia cererilor pe status (Funnel)",
    keywords: ["progresie", "flux cereri", "funnel", "pipeline", "etape"],
    example: "Cum arată progresia cererilor pe etape de status?",
    async run() {
      const rows = await statusFunnel();
      return {
        columns: ["etapa", "cereri"],
        rows: rows.map((r) => ({ etapa: r.stage, cereri: r.count })),
        chartType: "FUNNEL",
        params: {},
        sqlPreview: `SELECT status, COUNT(*) FROM "DmsRequest" WHERE status IN ('NOU','IN_LUCRU','IN_ASTEPTARE','FINALIZAT') GROUP BY status;`,
        explanation: "Am numărat cererile curente pe fiecare etapă de status (Nou → În lucru → În așteptare → Finalizat) — o fotografie curentă, nu o evoluție istorică a acelorași cereri prin etape.",
        title: "Progresia cererilor pe status (Funnel)",
      };
    },
  },
  {
    key: "domain_breakdown",
    title: "Distribuția pe domeniu",
    keywords: ["domeniu"],
    example: "Câte cereri sunt pe fiecare domeniu?",
    async run() {
      const rows = await countByDomain();
      return {
        columns: ["domeniu", "cereri"],
        rows: rows.map((r) => ({ domeniu: r.domain, cereri: r.count })),
        chartType: "BAR",
        params: {},
        sqlPreview: `SELECT domain, COUNT(*) FROM "DmsRequest" WHERE domain IS NOT NULL GROUP BY domain ORDER BY COUNT(*) DESC;`,
        explanation: "Am numărat toate cererile, grupate pe domeniul asociat.",
        title: "Distribuția pe domeniu",
      };
    },
  },
  {
    key: "category_breakdown",
    title: "Distribuția pe categorie",
    keywords: ["categorie", "frecventa", "des intalnit", "top categorie"],
    example: "Care este cea mai frecventă categorie de cereri?",
    async run() {
      const rows = await countByCategory();
      return {
        columns: ["categorie", "cereri"],
        rows: rows.map((r) => ({ categorie: r.category, cereri: r.count })),
        chartType: "BAR",
        params: {},
        sqlPreview: `SELECT category, COUNT(*) FROM "DmsRequest" GROUP BY category ORDER BY COUNT(*) DESC;`,
        explanation: "Am numărat toate cererile, grupate pe categorie, ordonate descrescător.",
        title: "Distribuția pe categorie",
      };
    },
  },
  {
    key: "volume_trend",
    title: "Volum de cereri în timp",
    keywords: ["volum", "trend", "evolutie", "lunar", "inregistrate", "pe luna"],
    example: "Care a fost volumul de cereri înregistrate pe lună?",
    async run(q, forced) {
      const year = forced?.year ?? extractYear(q);
      const rows = await volumeTrendByMonth(year ? 12 : 6, year);
      return {
        columns: ["luna", "cereri"],
        rows: rows.map((r) => ({ luna: r.label, cereri: r.count })),
        chartType: "LINE",
        params: year ? { year } : {},
        sqlPreview: `SELECT date_trunc('month', "registeredAt") AS luna, COUNT(*) FROM "DmsRequest"${year ? ` WHERE EXTRACT(YEAR FROM "registeredAt") = ${year}` : ""} GROUP BY luna ORDER BY luna;`,
        explanation: `Am numărat cererile înregistrate pe fiecare lună${year ? ` din ${year}` : " din ultimele 6 luni"}.`,
        title: "Volum de cereri în timp",
      };
    },
  },
  {
    key: "workload_by_user",
    title: "Volum de lucru pe utilizator",
    keywords: ["utilizator", "angajat", "persoana", "alocate"],
    example: "Care utilizator are cele mai multe cereri alocate?",
    async run() {
      const rows = await workloadByUser();
      return {
        columns: ["utilizator", "cereri alocate"],
        rows: rows.map((r) => ({ utilizator: r.name, "cereri alocate": r.count })),
        chartType: "BAR",
        params: {},
        sqlPreview: `SELECT u.name, COUNT(*) FROM "DmsRequest" r JOIN "User" u ON u.id = r."assignedToId" WHERE r.status IN ('NOU','IN_LUCRU','IN_ASTEPTARE') GROUP BY u.name ORDER BY COUNT(*) DESC;`,
        explanation: "Am numărat cererile active alocate fiecărui utilizator.",
        title: "Volum de lucru pe utilizator",
      };
    },
  },
  {
    key: "workload_by_group",
    title: "Volum de lucru pe grup/echipă",
    keywords: ["grup", "echipa", "departament"],
    example: "Care echipă are cel mai mare volum de lucru?",
    async run() {
      const rows = await workloadByGroup();
      return {
        columns: ["grup", "cereri alocate"],
        rows: rows.map((r) => ({ grup: r.name, "cereri alocate": r.count })),
        chartType: "BAR",
        params: {},
        sqlPreview: `SELECT g.name, COUNT(*) FROM "DmsRequest" r JOIN "Group" g ON g.id = r."assignedGroupId" WHERE r.status IN ('NOU','IN_LUCRU','IN_ASTEPTARE') GROUP BY g.name ORDER BY COUNT(*) DESC;`,
        explanation: "Am numărat cererile active alocate fiecărui grup/echipă.",
        title: "Volum de lucru pe grup",
      };
    },
  },
  {
    key: "backlog_summary",
    title: "Backlog curent",
    keywords: ["backlog", "nefinalizat", "deschise", "in asteptare total"],
    example: "Câte cereri sunt încă nefinalizate (backlog)?",
    async run() {
      const [backlog, unassigned] = await Promise.all([backlogCount(), unassignedCount()]);
      return {
        columns: ["indicator", "valoare"],
        rows: [
          { indicator: "Total backlog (nefinalizate)", valoare: backlog },
          { indicator: "Din care nealocate", valoare: unassigned },
        ],
        chartType: "KPI",
        params: {},
        sqlPreview: `SELECT COUNT(*) FROM "DmsRequest" WHERE status IN ('NOU','IN_LUCRU','IN_ASTEPTARE');`,
        explanation: "Am numărat toate cererile care nu sunt încă finalizate sau respinse.",
        title: "Backlog curent",
      };
    },
  },
  {
    key: "avg_resolution",
    title: "Timp mediu de soluționare",
    keywords: ["timp mediu", "durata medie", "cat dureaza", "solutionare"],
    example: "Care este timpul mediu de soluționare a unei cereri?",
    async run() {
      const avg = await avgResolutionDays();
      return {
        columns: ["indicator", "valoare"],
        rows: [{ indicator: "Timp mediu de soluționare (zile, aproximativ)", valoare: avg ?? "—" }],
        chartType: "KPI",
        params: {},
        sqlPreview: `SELECT AVG("updatedAt" - "registeredAt") FROM "DmsRequest" WHERE status = 'FINALIZAT';`,
        explanation: "Aproximare: diferența dintre ultima actualizare (la finalizare) și data înregistrării, pentru cererile finalizate — nu există un câmp dedicat „dată soluționare”.",
        title: "Timp mediu de soluționare",
      };
    },
  },
];

function scoreIntent(intent: Intent, normalizedQuestion: string): number {
  return intent.keywords.reduce((score, kw) => (normalizedQuestion.includes(normalize(kw)) ? score + 1 : score), 0);
}

export async function runNl2Sql(
  question: string,
  opts?: { forceIntent?: string; params?: Record<string, any> }
): Promise<Nl2SqlResult> {
  const intent = opts?.forceIntent
    ? INTENTS.find((i) => i.key === opts.forceIntent)
    : (() => {
        const normalized = normalize(question);
        const scored = INTENTS.map((i) => ({ intent: i, score: scoreIntent(i, normalized) })).sort((a, b) => b.score - a.score);
        return scored[0]?.score > 0 ? scored[0].intent : undefined;
      })();

  if (!intent) {
    return {
      matched: false,
      intentKey: null,
      title: "Nu am înțeles întrebarea",
      explanation: "Nu am găsit o interogare predefinită care să corespundă întrebării — încearcă una dintre variantele de mai jos sau reformulează folosind termeni precum „întârzieri”, „status”, „categorie”, „volum”, „utilizator” sau „backlog”.",
      sqlPreview: "",
      chartType: "TABLE",
      columns: [],
      rows: [],
      params: {},
      suggestions: INTENTS.map((i) => i.example),
    };
  }

  const result = await intent.run(question, opts?.params);
  return { matched: true, intentKey: intent.key, ...result };
}

export const NL2SQL_EXAMPLES = INTENTS.map((i) => i.example);
