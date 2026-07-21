import { useEffect, useState } from "react";
import { Search, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, Trophy, MapPinned, Users, Cake, Medal, Building2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, SectionHeader, Pill } from "../components/ui";
import { T } from "../theme";
import { useAuth } from "../features/iam/AuthContext";
import {
  fetchYearbookPublic,
  fetchYearbookEditions,
  generateYearbookEdition,
  updateYearbookStatus,
  downloadYearbookPdf,
  downloadYearbookXlsx,
  searchAthleteProfiles,
  YearbookEditionDto,
  YearbookPublicDto,
  AthleteProfileDto,
} from "../features/yearbook/api";

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR", "EVALUATOR", "AUTOR", "CO_AUTOR"];

// Paletă distinctă (bleumarin + auriu) pentru Almanahul Online — se citește ca o
// publicație oficială, nu ca un ecran obișnuit de back-office din restul platformei.
const ALMANAH = {
  navy: "#0F1B33",
  navySoft: "#1C2B4A",
  gold: "#C9A24B",
  goldTint: "#FBF4E4",
  cream: "#FAF7F0",
};

const RANKING_TABS = [
  { key: "byFederation", label: "Federații", icon: Trophy },
  { key: "byCounty", label: "Județe", icon: MapPinned },
  { key: "byAthlete", label: "Sportivi", icon: Users },
  { key: "byAgeCategory", label: "Categorii de vârstă", icon: Cake },
  { key: "byMedalType", label: "Medalii", icon: Medal },
  { key: "byFacilityOwner", label: "Unități sportive", icon: Building2 },
] as const;

// Coloane afișate explicit per clasament — niciodată cheile brute din date (ID-uri
// tehnice precum federationId nu au ce căuta într-o publicație oficială), cu eticheta
// principală (medalii/număr) marcată distinct, ca într-un clasament real.
type Column = { key: string; label: string; highlight?: boolean; align?: "left" | "right" };
const RANKING_COLUMNS: Record<(typeof RANKING_TABS)[number]["key"], Column[]> = {
  byFederation: [
    { key: "name", label: "Federație" },
    { key: "disciplineType", label: "Disciplină" },
    { key: "athleteCount", label: "Sportivi", align: "right" },
    { key: "resultCount", label: "Rezultate", align: "right" },
    { key: "medalCount", label: "Medalii", align: "right", highlight: true },
  ],
  byCounty: [
    { key: "county", label: "Județ" },
    { key: "clubCount", label: "Cluburi", align: "right" },
    { key: "medalCount", label: "Medalii", align: "right", highlight: true },
  ],
  byAthlete: [
    { key: "name", label: "Sportiv" },
    { key: "clubName", label: "Club" },
    { key: "gold", label: "Aur", align: "right" },
    { key: "silver", label: "Argint", align: "right" },
    { key: "bronze", label: "Bronz", align: "right" },
    { key: "medalCount", label: "Total", align: "right", highlight: true },
  ],
  byAgeCategory: [
    { key: "category", label: "Categorie" },
    { key: "athleteCount", label: "Sportivi", align: "right" },
    { key: "medalCount", label: "Medalii", align: "right", highlight: true },
  ],
  byMedalType: [
    { key: "medal", label: "Tip medalie" },
    { key: "count", label: "Număr", align: "right", highlight: true },
  ],
  byFacilityOwner: [
    { key: "ownerType", label: "Deținător" },
    { key: "facilityCount", label: "Nr. unități", align: "right", highlight: true },
  ],
};

const RANK_BADGE: Record<number, { bg: string; color: string }> = {
  0: { bg: "#C9A24B", color: "#0F1B33" }, // aur
  1: { bg: "#C7CDD6", color: "#0F1B33" }, // argint
  2: { bg: "#B5754A", color: "#FAF7F0" }, // bronz
};

function RankingTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: Column[] }) {
  if (rows.length === 0) return <p style={{ color: ALMANAH.cream, opacity: 0.55, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Fără date pentru această ediție.</p>;
  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${ALMANAH.navySoft}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)" }}>
            <th style={{ width: 40, padding: "10px 8px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: ALMANAH.gold, borderBottom: `1px solid ${ALMANAH.navySoft}` }}>#</th>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align || "left",
                  padding: "10px 14px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  color: ALMANAH.gold,
                  borderBottom: `1px solid ${ALMANAH.navySoft}`,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const badge = RANK_BADGE[i];
            return (
              <tr key={i} style={{ background: i % 2 === 1 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                <td style={{ padding: "9px 8px", textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: badge ? badge.bg : "transparent",
                      color: badge ? badge.color : ALMANAH.cream,
                      opacity: badge ? 1 : 0.45,
                      border: badge ? "none" : `1px solid ${ALMANAH.navySoft}`,
                    }}
                  >
                    {i + 1}
                  </span>
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      padding: "9px 14px",
                      fontSize: 13,
                      textAlign: c.align || "left",
                      color: c.highlight ? ALMANAH.gold : ALMANAH.cream,
                      fontWeight: c.highlight ? 700 : 400,
                      opacity: c.highlight ? 1 : 0.92,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(r[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AlmanahPublic() {
  const [data, setData] = useState<YearbookPublicDto | null>(null);
  const [rankingTab, setRankingTab] = useState<(typeof RANKING_TABS)[number]["key"]>("byFederation");
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<AthleteProfileDto[] | null>(null);

  useEffect(() => {
    fetchYearbookPublic().then(setData).catch(() => setData({ latest: null, history: [] }));
  }, []);

  async function handleSearch() {
    if (query.trim().length < 2) return setProfiles(null);
    setProfiles(await searchAthleteProfiles(query.trim()));
  }

  const latest = data?.latest;

  return (
    <div
      style={{
        background: `linear-gradient(165deg, ${ALMANAH.navy}, ${ALMANAH.navySoft})`,
        borderRadius: 20,
        padding: "44px 36px",
        color: ALMANAH.cream,
        marginBottom: 24,
        boxShadow: "0 20px 48px -20px rgba(15,27,51,0.5)",
        border: "1px solid rgba(201,162,75,0.18)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: ALMANAH.gold, marginBottom: 12 }}>Agenția Națională pentru Sport</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 700, margin: 0, letterSpacing: -0.5, textWrap: "balance" as any, color: ALMANAH.cream }}>Almanahul Sportului</h1>
        <div style={{ width: 64, height: 2, background: ALMANAH.gold, margin: "18px auto 0", opacity: 0.6 }} />
        {latest && (
          <div style={{ marginTop: 16, fontSize: 15, color: ALMANAH.cream, opacity: 0.85 }}>
            Ediția <strong style={{ color: ALMANAH.gold }}>{latest.year}</strong> · publicată {latest.publishedAt && new Date(latest.publishedAt).toLocaleDateString("ro-RO")}
          </div>
        )}
      </div>

      {!latest ? (
        <p style={{ textAlign: "center", opacity: 0.7 }}>Nicio ediție oficială publicată încă.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 26 }}>
            {RANKING_TABS.map((t) => {
              const Icon = t.icon;
              const active = rankingTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setRankingTab(t.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    border: `1px solid ${active ? ALMANAH.gold : "rgba(250,247,240,0.15)"}`,
                    background: active ? ALMANAH.gold : "transparent",
                    color: active ? ALMANAH.navy : ALMANAH.cream,
                    borderRadius: 999,
                    padding: "7px 16px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "background .15s ease, border-color .15s ease",
                  }}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ maxWidth: 860, margin: "0 auto 32px" }}>
            <RankingTable rows={(latest.snapshot.rankings as any)[rankingTab] || []} columns={RANKING_COLUMNS[rankingTab]} />
          </div>
        </>
      )}

      <div style={{ height: 1, background: "rgba(250,247,240,0.1)", margin: "8px 0 28px" }} />

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: ALMANAH.gold, marginBottom: 10, textAlign: "center" }}>
          Profil public sportiv/antrenor
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Caută după nume..."
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid rgba(201,162,75,0.4)`, color: ALMANAH.cream, borderRadius: 8 }}
          />
          <Button onClick={handleSearch} style={{ display: "flex", alignItems: "center", gap: 6, background: ALMANAH.gold, color: ALMANAH.navy }}>
            <Search size={14} /> Caută
          </Button>
        </div>
        {profiles && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {profiles.map((p) => (
              <div key={p.id} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${ALMANAH.navySoft}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{p.club || "fără club"} · {p.federation || "—"}</div>
                {p.results.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, opacity: 0.85 }}>
                    {new Date(r.date).toLocaleDateString("ro-RO")} — {r.competitionName}: {r.result} {r.medal && `(${r.medal})`}
                  </div>
                ))}
              </div>
            ))}
            {profiles.length === 0 && <p style={{ opacity: 0.6, fontSize: 13, textAlign: "center" }}>Niciun rezultat.</p>}
          </div>
        )}
      </div>

      {data && data.history.length > 1 && (
        <div style={{ textAlign: "center", marginTop: 30, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: ALMANAH.cream, opacity: 0.5 }}>Ediții anterioare:</span>
          {data.history.slice(1).map((h) => (
            <span key={h.id} style={{ fontSize: 11.5, fontWeight: 700, color: ALMANAH.gold, border: `1px solid rgba(201,162,75,0.35)`, borderRadius: 999, padding: "3px 10px" }}>
              {h.year}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminPanel() {
  const [editions, setEditions] = useState<YearbookEditionDto[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchYearbookEditions().then(setEditions).catch(() => setEditions([]));
  }
  useEffect(load, []);

  async function handleGenerate() {
    setError(null);
    try {
      await generateYearbookEdition(Number(year));
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut genera ediția");
    }
  }

  async function handleStatus(edition: YearbookEditionDto, status: "VALIDAT" | "OFICIAL") {
    setError(null);
    try {
      await updateYearbookStatus(edition.id, status);
      load();
    } catch (e: any) {
      const warnings = e?.response?.data?.warnings;
      if (warnings?.length && window.confirm(`Există ${warnings.length} avertismente de date lipsă. Continui oricum?`)) {
        await updateYearbookStatus(edition.id, status, true);
        load();
      } else {
        setError(e?.response?.data?.error || "Tranziție eșuată");
      }
    }
  }

  return (
    <Card style={{ marginBottom: 24 }}>
      <SectionHeader title="Administrare ediții" />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 120 }} />
        <Button onClick={handleGenerate}>Generează ediție nouă</Button>
      </div>
      {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {editions.map((e) => (
          <div key={e.id} style={{ padding: 12, background: T.bgSoft, borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{e.year}</strong> · v{e.version}{" "}
                <Pill color={e.status === "OFICIAL" ? T.success : e.status === "VALIDAT" ? T.info : T.warn} bg={e.status === "OFICIAL" ? T.successTint : e.status === "VALIDAT" ? T.infoTint : T.warnTint}>
                  {e.status}
                </Pill>
                {e.missingDataWarnings.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: T.warn, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <AlertTriangle size={12} /> {e.missingDataWarnings.length} date lipsă
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {e.status === "PROVIZORIU" && (
                  <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => handleStatus(e, "VALIDAT")}>
                    Validează
                  </Button>
                )}
                {e.status === "VALIDAT" && (
                  <Button style={{ padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} onClick={() => handleStatus(e, "OFICIAL")}>
                    <CheckCircle2 size={12} /> Publică oficial
                  </Button>
                )}
                <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} onClick={() => downloadYearbookPdf(e)}>
                  <Download size={12} /> PDF
                </Button>
                <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} onClick={() => downloadYearbookXlsx(e)}>
                  <FileSpreadsheet size={12} /> Excel
                </Button>
              </div>
            </div>
          </div>
        ))}
        {editions.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Nicio ediție generată încă.</p>}
      </div>
    </Card>
  );
}

export default function YearbookPage() {
  const { user } = useAuth();
  const isStaff = user && STAFF_ROLES.includes(user.role);

  return (
    <AppShell title="Anuarul Sportului" subtitle="Publicație oficială anuală — clasamente generate exclusiv din date validate de federații și cluburi">
      <AlmanahPublic />
      {isStaff && <AdminPanel />}
    </AppShell>
  );
}
