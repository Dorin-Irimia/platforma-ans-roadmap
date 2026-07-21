import { useEffect, useState } from "react";
import { Ticket, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { T } from "../theme";
import { useAuth } from "../features/iam/AuthContext";
import {
  fetchMuseumSettings,
  fetchArtifacts,
  createArtifact,
  deleteArtifact,
  artifactPhotoUrl,
  bookVisit,
  checkInVisit,
  fetchVisits,
  MuseumSettingsDto,
  MuseumArtifactDto,
  MuseumVisitDto,
} from "../features/museum/api";

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR", "EVALUATOR", "AUTOR", "CO_AUTOR"];

function TicketsTab() {
  const [settings, setSettings] = useState<MuseumSettingsDto | null>(null);
  const [draft, setDraft] = useState({ visitorName: "", visitorEmail: "", visitDate: "", timeSlot: "10:00-11:00", peopleCount: 1 });
  const [booked, setBooked] = useState<MuseumVisitDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkinCode, setCheckinCode] = useState("");
  const [checkinResult, setCheckinResult] = useState<MuseumVisitDto | null>(null);
  const { user } = useAuth();
  const isStaff = user && STAFF_ROLES.includes(user.role);

  useEffect(() => {
    fetchMuseumSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  async function handleBook() {
    setError(null);
    try {
      const visit = await bookVisit(draft);
      setBooked(visit);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut rezerva biletul");
    }
  }

  async function handleCheckin() {
    try {
      const result = await checkInVisit(checkinCode);
      setCheckinResult(result);
      loadTodayVisits();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Bilet invalid");
    }
  }

  const [todayVisits, setTodayVisits] = useState<MuseumVisitDto[]>([]);
  function loadTodayVisits() {
    if (!isStaff) return;
    fetchVisits(new Date().toISOString().slice(0, 10)).then(setTodayVisits).catch(() => setTodayVisits([]));
  }
  useEffect(loadTodayVisits, [isStaff]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: isStaff ? "1fr 380px" : "1fr", gap: 24 }}>
      <Card>
        <SectionHeader title="Rezervă un bilet" />
        {settings && <p style={{ fontSize: 12.5, color: T.ink3, marginTop: -6, marginBottom: 14 }}>Preț: {settings.ticketPriceRon} RON/persoană · capacitate maximă {settings.maxCapacityPerSlot} persoane/interval</p>}
        {!booked ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><FieldLabel>Nume vizitator</FieldLabel><input value={draft.visitorName} onChange={(e) => setDraft({ ...draft, visitorName: e.target.value })} style={{ width: "100%" }} /></div>
              <div><FieldLabel>Email</FieldLabel><input value={draft.visitorEmail} onChange={(e) => setDraft({ ...draft, visitorEmail: e.target.value })} style={{ width: "100%" }} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><FieldLabel>Data vizitei</FieldLabel><input type="date" value={draft.visitDate} onChange={(e) => setDraft({ ...draft, visitDate: e.target.value })} style={{ width: "100%" }} /></div>
              <div>
                <FieldLabel>Interval orar</FieldLabel>
                <select value={draft.timeSlot} onChange={(e) => setDraft({ ...draft, timeSlot: e.target.value })} style={{ width: "100%" }}>
                  {["10:00-11:00", "11:00-12:00", "12:00-13:00", "14:00-15:00", "15:00-16:00"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><FieldLabel>Nr. persoane</FieldLabel><input type="number" min={1} max={50} value={draft.peopleCount} onChange={(e) => setDraft({ ...draft, peopleCount: Number(e.target.value) || 1 })} style={{ width: "100%" }} /></div>
            </div>
            {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
            <Button onClick={handleBook} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Ticket size={15} /> Rezervă biletul
            </Button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Bilet confirmat: {booked.ticketCode}</p>
            <p style={{ fontSize: 13, color: T.ink3, marginBottom: 16 }}>{booked.peopleCount} persoane · {booked.priceTotal} RON total</p>
            {booked.qrCodeDataUrl && <img src={booked.qrCodeDataUrl} alt="Cod QR bilet" style={{ width: 180, height: 180 }} />}
            <div style={{ marginTop: 16 }}>
              <Button variant="ghost" onClick={() => setBooked(null)}>Rezervă alt bilet</Button>
            </div>
          </div>
        )}
      </Card>

      {isStaff && (
        <Card>
          <SectionHeader title="Check-in la poartă" />
          <FieldLabel>Cod bilet</FieldLabel>
          <input value={checkinCode} onChange={(e) => setCheckinCode(e.target.value)} placeholder="MUZ-XXXXXXXX" style={{ width: "100%", marginBottom: 12 }} />
          <Button onClick={handleCheckin} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={14} /> Validează
          </Button>
          {checkinResult && (
            <div style={{ marginTop: 14, padding: 10, background: T.successTint, borderRadius: 10, fontSize: 13, color: T.success }}>
              Check-in reușit — {checkinResult.visitorName} ({checkinResult.peopleCount} persoane)
            </div>
          )}
        </Card>
      )}

      {isStaff && (
        <Card style={{ gridColumn: "1 / -1" }}>
          <SectionHeader title="Rezervări de azi" />
          <p style={{ fontSize: 12, color: T.ink3, marginTop: -8, marginBottom: 12 }}>
            Un bilet necheck-in-uit la prea mult timp după interval e marcat automat „neprezentare" — locul se eliberează pentru rezervări noi.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayVisits.map((v) => (
              <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${T.line2}` }}>
                <span>{v.timeSlot} · {v.visitorName} ({v.peopleCount} pers.)</span>
                {v.checkedInAt ? (
                  <Pill color={T.success} bg={T.successTint}>Check-in</Pill>
                ) : v.noShow ? (
                  <Pill color={T.danger} bg={T.dangerTint}>Neprezentare</Pill>
                ) : (
                  <Pill color={T.ink3} bg={T.line2}>Așteptat</Pill>
                )}
              </div>
            ))}
            {todayVisits.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Nicio rezervare azi.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}

function ArtifactsTab() {
  const [artifacts, setArtifacts] = useState<MuseumArtifactDto[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", category: "", isFragile: false });
  const [photo, setPhoto] = useState<File | null>(null);

  function load() {
    fetchArtifacts().then(setArtifacts).catch(() => setArtifacts([]));
  }
  useEffect(load, []);

  async function handleCreate() {
    await createArtifact({ ...draft, photo });
    setShowCreate(false);
    setDraft({ name: "", description: "", category: "", isFragile: false });
    setPhoto(null);
    load();
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => setShowCreate((s) => !s)}>+ Artefact nou</Button>
      </div>
      {showCreate && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>Nume</FieldLabel><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: "100%" }} /></div>
            <div><FieldLabel>Categorie</FieldLabel><input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ width: "100%" }} /></div>
          </div>
          <FieldLabel>Descriere</FieldLabel>
          <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ width: "100%", minHeight: 70, marginBottom: 12 }} />
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox" checked={draft.isFragile} onChange={(e) => setDraft({ ...draft, isFragile: e.target.checked })} /> Piesă fragilă
          </label>
          <FieldLabel>Fotografie (opțional)</FieldLabel>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} style={{ marginBottom: 14 }} />
          <Button onClick={handleCreate}>Salvează</Button>
        </Card>
      )}

      <SectionHeader title={`${artifacts.length} artefacte`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {artifacts.map((a) => (
          <Card key={a.id}>
            <div style={{ width: "100%", height: 120, borderRadius: 10, background: T.line2, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, overflow: "hidden" }}>
              {a.photoStoragePath ? <img src={artifactPhotoUrl(a.id)} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={28} color={T.ink4} />}
            </div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.name}</div>
            <div style={{ fontSize: 11.5, color: T.ink3, marginBottom: 8 }}>{a.category}</div>
            {a.isFragile && <Pill color={T.warn} bg={T.warnTint} style={{ marginBottom: 8 }}>Fragil</Pill>}
            <div>
              <Button variant="danger" style={{ fontSize: 11.5, padding: "5px 10px" }} onClick={() => deleteArtifact(a.id).then(load)}>Șterge</Button>
            </div>
          </Card>
        ))}
        {artifacts.length === 0 && <p style={{ color: T.ink3 }}>Niciun artefact adăugat încă.</p>}
      </div>
    </div>
  );
}

export default function MuseumPage() {
  const { user } = useAuth();
  const isStaff = user && STAFF_ROLES.includes(user.role);
  const [tab, setTab] = useState<"bilete" | "artefacte">("bilete");

  return (
    <AppShell title="Galeria Marilor Sportivi" subtitle="Bilete online cu cod QR și catalogul artefactelor">
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${T.line}` }}>
        {[{ key: "bilete" as const, label: "Bilete" }, ...(isStaff ? [{ key: "artefacte" as const, label: "Artefacte" }] : [])].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ border: "none", background: "none", padding: "8px 4px", marginRight: 18, fontSize: 13, fontWeight: 700, cursor: "pointer", color: tab === t.key ? T.brand : T.ink3, borderBottom: tab === t.key ? `2px solid ${T.brand}` : "2px solid transparent" }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "bilete" && <TicketsTab />}
      {tab === "artefacte" && isStaff && <ArtifactsTab />}
    </AppShell>
  );
}
