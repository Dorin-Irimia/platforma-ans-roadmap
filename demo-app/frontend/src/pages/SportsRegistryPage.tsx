import { useEffect, useState } from "react";
import { ShieldCheck, History, ArrowLeftRight, Award, FileBadge } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { T } from "../theme";
import {
  fetchFederations,
  createFederation,
  fetchFederationHistory,
  fetchClubs,
  createClub,
  updateClubDues,
  fetchClubHistory,
  fetchAthletes,
  createAthlete,
  fetchAthleteEligibility,
  requestTransfer,
  gdprEraseAthlete,
  fetchCoaches,
  createCoach,
  requestCoachEmerit,
  fetchFacilities,
  createFacility,
  updateFacility,
  requestFacilityHomologation,
  fetchFacilityHistory,
  requestCis,
  fetchCertificates,
  SportsOrgType,
  FederationDto,
  ClubDto,
  AthleteDto,
  CoachDto,
  FacilityDto,
  FacilityCategory,
  HistoryEntryDto,
  CisCertificateDto,
} from "../features/sports-registry/api";

const ORG_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  ACTIVE: { color: T.success, bg: T.successTint, label: "Activă" },
  SUSPENDED: { color: T.warn, bg: T.warnTint, label: "Suspendată" },
  DISSOLVED: { color: T.danger, bg: T.dangerTint, label: "Dizolvată" },
  UNDER_INVESTIGATION: { color: T.progress, bg: T.progressTint, label: "Sub investigație" },
};

function HistoryModal({ title, entries, onClose }: { title: string; entries: HistoryEntryDto[]; onClose: () => void }) {
  return (
    <Modal isOpen onClose={onClose} width={480} maxHeight="80vh">
        <Card>
          <SectionHeader title={title} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {entries.map((e) => (
              <div key={e.id} style={{ padding: 10, background: T.line2, borderRadius: 10, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{e.field}</strong>
                  {e.isMajorChange && <Pill color={T.danger} bg={T.dangerTint}>Modificare majoră</Pill>}
                </div>
                <div style={{ color: T.ink3, marginTop: 4 }}>
                  {e.oldValue || "—"} → {e.newValue || "—"}
                </div>
                <div style={{ color: T.ink4, fontSize: 11, marginTop: 2 }}>{new Date(e.changedAt).toLocaleString("ro-RO")}</div>
              </div>
            ))}
            {entries.length === 0 && <p style={{ color: T.ink3 }}>Niciun istoric încă.</p>}
          </div>
          <Button variant="ghost" style={{ marginTop: 14 }} onClick={onClose}>Închide</Button>
        </Card>
    </Modal>
  );
}

// ------------------------------------------------------------
function FederationsTab() {
  const [federations, setFederations] = useState<FederationDto[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<{ name: string; disciplineType: string; orgType: SportsOrgType; county: string; cif: string }>({
    name: "",
    disciplineType: "",
    orgType: "NATIONAL_FEDERATION",
    county: "",
    cif: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ title: string; entries: HistoryEntryDto[] } | null>(null);
  const [certificates, setCertificates] = useState<Record<string, CisCertificateDto[]>>({});

  function load() {
    fetchFederations().then(setFederations).catch(() => setFederations([]));
  }
  useEffect(load, []);

  async function handleCreate() {
    setError(null);
    try {
      await createFederation({ ...draft, county: draft.county || undefined, cif: draft.cif || undefined });
      setShowCreate(false);
      setDraft({ name: "", disciplineType: "", orgType: "NATIONAL_FEDERATION", county: "", cif: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut crea federația");
    }
  }

  async function loadCertificates(id: string) {
    const certs = await fetchCertificates("FEDERATION", id);
    setCertificates((prev) => ({ ...prev, [id]: certs }));
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => setShowCreate((s) => !s)}>+ Federație nouă</Button>
      </div>
      {showCreate && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <FieldLabel>Nume</FieldLabel>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div>
              <FieldLabel>Ramură sportivă</FieldLabel>
              <input value={draft.disciplineType} onChange={(e) => setDraft({ ...draft, disciplineType: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div>
              <FieldLabel>Tip organizație</FieldLabel>
              <select value={draft.orgType} onChange={(e) => setDraft({ ...draft, orgType: e.target.value as any })} style={{ width: "100%" }}>
                <option value="NATIONAL_FEDERATION">Federație națională</option>
                <option value="COUNTY_ASSOCIATION">Asociație județeană</option>
                <option value="PROFESSIONAL_LEAGUE">Ligă profesionistă</option>
              </select>
            </div>
          </div>
          {draft.orgType === "COUNTY_ASSOCIATION" && (
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Județ</FieldLabel>
              <input value={draft.county} onChange={(e) => setDraft({ ...draft, county: e.target.value })} style={{ width: "100%" }} />
            </div>
          )}
          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
          <Button onClick={handleCreate}>Salvează</Button>
        </Card>
      )}

      <SectionHeader title={`${federations.length} federații/asociații/ligi`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {federations.map((f) => {
          const st = ORG_STATUS_STYLE[f.status];
          return (
            <Card key={f.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>
                    {f.disciplineType} · {f.orgType === "NATIONAL_FEDERATION" ? "Federație națională" : f.orgType === "COUNTY_ASSOCIATION" ? `Asociație județeană (${f.county})` : "Ligă profesionistă"} · {f._count?.clubs ?? 0} cluburi
                  </div>
                  {certificates[f.id]?.map((c) => (
                    <Pill key={c.id} color={T.brand} bg={T.brandTint} style={{ marginTop: 6, marginRight: 6 }}>
                      <FileBadge size={11} /> {c.certificateNumber} ({c.status})
                    </Pill>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Pill color={st.color} bg={st.bg}>{st.label}</Pill>
                  <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={async () => setHistory({ title: `Istoric — ${f.name}`, entries: await fetchFederationHistory(f.id) })}>
                    <History size={12} />
                  </Button>
                  <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => loadCertificates(f.id)}>
                    <FileBadge size={12} /> CIS
                  </Button>
                  <Button
                    variant="ghost"
                    style={{ padding: "6px 10px", fontSize: 11.5 }}
                    onClick={async () => { await requestCis("FEDERATION", f.id); loadCertificates(f.id); }}
                  >
                    Solicită CIS
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {federations.length === 0 && <p style={{ color: T.ink3 }}>Nicio federație creată încă.</p>}
      </div>

      {history && <HistoryModal title={history.title} entries={history.entries} onClose={() => setHistory(null)} />}
    </div>
  );
}

// ------------------------------------------------------------
function ClubsTab() {
  const [clubs, setClubs] = useState<ClubDto[]>([]);
  const [federations, setFederations] = useState<FederationDto[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", clubType: "MONOSPORT", federationId: "" });
  const [history, setHistory] = useState<{ title: string; entries: HistoryEntryDto[] } | null>(null);

  function load() {
    fetchClubs().then(setClubs).catch(() => setClubs([]));
  }
  useEffect(() => {
    load();
    fetchFederations().then(setFederations).catch(() => setFederations([]));
  }, []);

  async function handleCreate() {
    if (!draft.federationId) return;
    await createClub(draft);
    setShowCreate(false);
    setDraft({ name: "", clubType: "MONOSPORT", federationId: "" });
    load();
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => setShowCreate((s) => !s)}>+ Club nou</Button>
      </div>
      {showCreate && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <FieldLabel>Nume</FieldLabel>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div>
              <FieldLabel>Tip</FieldLabel>
              <select value={draft.clubType} onChange={(e) => setDraft({ ...draft, clubType: e.target.value })} style={{ width: "100%" }}>
                <option value="MONOSPORT">Monosport</option>
                <option value="POLISPORT">Polisport</option>
              </select>
            </div>
            <div>
              <FieldLabel>Federație</FieldLabel>
              <select value={draft.federationId} onChange={(e) => setDraft({ ...draft, federationId: e.target.value })} style={{ width: "100%" }}>
                <option value="">Alege federația...</option>
                {federations.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={handleCreate}>Salvează</Button>
        </Card>
      )}

      <SectionHeader title={`${clubs.length} cluburi`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {clubs.map((c) => {
          const st = ORG_STATUS_STYLE[c.status];
          return (
            <Card key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>
                    {c.clubType} · afiliat: {c.federation?.name} · {c._count?.athletes ?? 0} sportivi · {c._count?.coaches ?? 0} antrenori
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Pill color={st.color} bg={st.bg}>{st.label}</Pill>
                  {!c.duesUpToDate && <Pill color={T.danger} bg={T.dangerTint}>Taxe restante</Pill>}
                  <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => updateClubDues(c.id, !c.duesUpToDate).then(load)}>
                    {c.duesUpToDate ? "Marchează restanță" : "Marchează la zi"}
                  </Button>
                  <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={async () => setHistory({ title: `Istoric — ${c.name}`, entries: await fetchClubHistory(c.id) })}>
                    <History size={12} />
                  </Button>
                  <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => requestCis("CLUB", c.id)}>
                    Solicită CIS
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {clubs.length === 0 && <p style={{ color: T.ink3 }}>Niciun club creat încă.</p>}
      </div>

      {history && <HistoryModal title={history.title} entries={history.entries} onClose={() => setHistory(null)} />}
    </div>
  );
}

// ------------------------------------------------------------
function AthletesTab() {
  const [athletes, setAthletes] = useState<AthleteDto[]>([]);
  const [clubs, setClubs] = useState<ClubDto[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ cnp: "", firstName: "", lastName: "", clubId: "", medicalVisaExpiresAt: "" });
  const [eligibility, setEligibility] = useState<Record<string, { eligible: boolean; reasons: string[] }>>({});
  const [transferFor, setTransferFor] = useState<AthleteDto | null>(null);
  const [transferClubId, setTransferClubId] = useState("");

  function load() {
    fetchAthletes().then(setAthletes).catch(() => setAthletes([]));
  }
  useEffect(() => {
    load();
    fetchClubs().then(setClubs).catch(() => setClubs([]));
  }, []);

  async function handleCreate() {
    await createAthlete({ ...draft, clubId: draft.clubId || undefined, medicalVisaExpiresAt: draft.medicalVisaExpiresAt || undefined });
    setShowCreate(false);
    setDraft({ cnp: "", firstName: "", lastName: "", clubId: "", medicalVisaExpiresAt: "" });
    load();
  }

  async function checkEligibility(id: string) {
    const result = await fetchAthleteEligibility(id);
    setEligibility((prev) => ({ ...prev, [id]: result }));
  }

  async function handleTransfer() {
    if (!transferFor || !transferClubId) return;
    await requestTransfer(transferFor.id, transferClubId, "PERMANENT");
    setTransferFor(null);
    setTransferClubId("");
    load();
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => setShowCreate((s) => !s)}>+ Sportiv nou</Button>
      </div>
      {showCreate && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>CNP</FieldLabel><input value={draft.cnp} onChange={(e) => setDraft({ ...draft, cnp: e.target.value })} style={{ width: "100%" }} /></div>
            <div><FieldLabel>Prenume</FieldLabel><input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} style={{ width: "100%" }} /></div>
            <div><FieldLabel>Nume</FieldLabel><input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} style={{ width: "100%" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <FieldLabel>Club</FieldLabel>
              <select value={draft.clubId} onChange={(e) => setDraft({ ...draft, clubId: e.target.value })} style={{ width: "100%" }}>
                <option value="">Fără club</option>
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><FieldLabel>Viză medicală valabilă până la</FieldLabel><input type="date" value={draft.medicalVisaExpiresAt} onChange={(e) => setDraft({ ...draft, medicalVisaExpiresAt: e.target.value })} style={{ width: "100%" }} /></div>
          </div>
          <Button onClick={handleCreate}>Salvează</Button>
        </Card>
      )}

      <SectionHeader title={`${athletes.length} sportivi`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {athletes.map((a) => (
          <Card key={a.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{a.firstName} {a.lastName}</div>
                <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>CNP: {a.cnp} · club: {a.club?.name || "—"}</div>
                {eligibility[a.id] && (
                  <Pill color={eligibility[a.id].eligible ? T.success : T.danger} bg={eligibility[a.id].eligible ? T.successTint : T.dangerTint} style={{ marginTop: 6 }}>
                    {eligibility[a.id].eligible ? "Eligibil competiții" : eligibility[a.id].reasons.join(", ")}
                  </Pill>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }} onClick={() => checkEligibility(a.id)}>
                  <ShieldCheck size={12} /> Eligibilitate
                </Button>
                <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }} onClick={() => setTransferFor(a)}>
                  <ArrowLeftRight size={12} /> Transfer
                </Button>
                <Button variant="danger" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => gdprEraseAthlete(a.id).then(load)}>GDPR</Button>
              </div>
            </div>
          </Card>
        ))}
        {athletes.length === 0 && <p style={{ color: T.ink3 }}>Niciun sportiv creat încă.</p>}
      </div>

      <Modal isOpen={!!transferFor} onClose={() => setTransferFor(null)} width={400}>
        {transferFor && (
            <Card>
              <SectionHeader title={`Transfer — ${transferFor.firstName} ${transferFor.lastName}`} />
              <FieldLabel>Club destinație</FieldLabel>
              <select value={transferClubId} onChange={(e) => setTransferClubId(e.target.value)} style={{ width: "100%", marginBottom: 14 }}>
                <option value="">Alege clubul...</option>
                {clubs.filter((c) => c.id !== transferFor.clubId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p style={{ fontSize: 12, color: T.ink3 }}>Creează o cerere reală în Registratură, aprobată prin fluxul de Workflow configurat pentru categoria „transfer-sportiv".</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <Button variant="ghost" onClick={() => setTransferFor(null)}>Anulează</Button>
                <Button onClick={handleTransfer}>Inițiază transfer</Button>
              </div>
            </Card>
        )}
      </Modal>
    </div>
  );
}

// ------------------------------------------------------------
function CoachesTab() {
  const [coaches, setCoaches] = useState<CoachDto[]>([]);
  const [clubs, setClubs] = useState<ClubDto[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ cnp: "", firstName: "", lastName: "", clubId: "" });

  function load() {
    fetchCoaches().then(setCoaches).catch(() => setCoaches([]));
  }
  useEffect(() => {
    load();
    fetchClubs().then(setClubs).catch(() => setClubs([]));
  }, []);

  async function handleCreate() {
    await createCoach({ ...draft, clubId: draft.clubId || undefined });
    setShowCreate(false);
    setDraft({ cnp: "", firstName: "", lastName: "", clubId: "" });
    load();
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => setShowCreate((s) => !s)}>+ Antrenor nou</Button>
      </div>
      {showCreate && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>CNP</FieldLabel><input value={draft.cnp} onChange={(e) => setDraft({ ...draft, cnp: e.target.value })} style={{ width: "100%" }} /></div>
            <div><FieldLabel>Prenume</FieldLabel><input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} style={{ width: "100%" }} /></div>
            <div><FieldLabel>Nume</FieldLabel><input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} style={{ width: "100%" }} /></div>
            <div>
              <FieldLabel>Club</FieldLabel>
              <select value={draft.clubId} onChange={(e) => setDraft({ ...draft, clubId: e.target.value })} style={{ width: "100%" }}>
                <option value="">Fără club</option>
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={handleCreate}>Salvează</Button>
        </Card>
      )}

      <SectionHeader title={`${coaches.length} antrenori`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {coaches.map((c) => (
          <Card key={c.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{c.firstName} {c.lastName}</span>
                  {c.isEmerit && <Pill color={T.brand} bg={T.brandTint}><Award size={11} /> Emerit</Pill>}
                </div>
                <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>CNP: {c.cnp} · club: {c.club?.name || "—"} · {c.certifications?.length || 0} certificări</div>
              </div>
              {!c.isEmerit && (
                <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => requestCoachEmerit(c.id).then(load)}>
                  Solicită titlu emerit
                </Button>
              )}
            </div>
          </Card>
        ))}
        {coaches.length === 0 && <p style={{ color: T.ink3 }}>Niciun antrenor creat încă.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function FacilitiesTab() {
  const [facilities, setFacilities] = useState<FacilityDto[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<{ name: string; category: FacilityCategory; county: string }>({ name: "", category: "B1", county: "" });
  const [history, setHistory] = useState<{ title: string; entries: HistoryEntryDto[] } | null>(null);

  function load() {
    fetchFacilities().then(setFacilities).catch(() => setFacilities([]));
  }
  useEffect(load, []);

  async function handleCreate() {
    await createFacility(draft);
    setShowCreate(false);
    setDraft({ name: "", category: "B1", county: "" });
    load();
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => setShowCreate((s) => !s)}>+ Bază sportivă nouă</Button>
      </div>
      {showCreate && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>Nume</FieldLabel><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: "100%" }} /></div>
            <div>
              <FieldLabel>Categorie</FieldLabel>
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as any })} style={{ width: "100%" }}>
                {["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><FieldLabel>Județ</FieldLabel><input value={draft.county} onChange={(e) => setDraft({ ...draft, county: e.target.value })} style={{ width: "100%" }} /></div>
          </div>
          <p style={{ fontSize: 12, color: T.ink3, marginBottom: 12 }}>Bazele noi pornesc INACTIVE — devin ACTIVE doar prin fluxul real de omologare.</p>
          <Button onClick={handleCreate}>Salvează</Button>
        </Card>
      )}

      <SectionHeader title={`${facilities.length} baze sportive`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {facilities.map((f) => (
          <Card key={f.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{f.category} · {f.county} · {f.units.length} unități</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Pill color={f.status === "ACTIVE" ? T.success : f.status === "DEMOLISHED" ? T.danger : T.ink3} bg={f.status === "ACTIVE" ? T.successTint : f.status === "DEMOLISHED" ? T.dangerTint : T.line2}>
                  {f.status === "ACTIVE" ? "Activă" : f.status === "DEMOLISHED" ? "Demolată" : "Inactivă"}
                </Pill>
                <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={async () => setHistory({ title: `Istoric — ${f.name}`, entries: await fetchFacilityHistory(f.id) })}>
                  <History size={12} />
                </Button>
                {f.status === "INACTIVE" && (
                  <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => requestFacilityHomologation(f.id)}>
                    Solicită omologare
                  </Button>
                )}
                {f.status !== "DEMOLISHED" && (
                  <Button
                    variant="danger"
                    style={{ padding: "6px 10px", fontSize: 11.5 }}
                    onClick={() => updateFacility(f.id, { status: f.status === "ACTIVE" ? "INACTIVE" : "DEMOLISHED", isMajorChange: true }).then(load)}
                  >
                    {f.status === "ACTIVE" ? "Dezactivează" : "Marchează demolată"}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {facilities.length === 0 && <p style={{ color: T.ink3 }}>Nicio bază sportivă creată încă.</p>}
      </div>

      {history && <HistoryModal title={history.title} entries={history.entries} onClose={() => setHistory(null)} />}
    </div>
  );
}

// ------------------------------------------------------------
export default function SportsRegistryPage() {
  const [tab, setTab] = useState<"federatii" | "cluburi" | "sportivi" | "antrenori" | "baze">("federatii");

  const tabs = [
    { key: "federatii" as const, label: "Federații" },
    { key: "cluburi" as const, label: "Cluburi" },
    { key: "sportivi" as const, label: "Sportivi" },
    { key: "antrenori" as const, label: "Antrenori" },
    { key: "baze" as const, label: "Baze sportive" },
  ];

  return (
    <AppShell title="Registrul Sportiv" subtitle="Federații, cluburi, sportivi, antrenori și baze sportive — cu CIS, transferuri și omologări reale prin motorul de Workflow">
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${T.line}` }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: "none",
              background: "none",
              padding: "8px 4px",
              marginRight: 18,
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

      {tab === "federatii" && <FederationsTab />}
      {tab === "cluburi" && <ClubsTab />}
      {tab === "sportivi" && <AthletesTab />}
      {tab === "antrenori" && <CoachesTab />}
      {tab === "baze" && <FacilitiesTab />}
    </AppShell>
  );
}
