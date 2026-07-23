import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, ArrowRightLeft, Upload, FileText, Trash2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { T } from "../theme";
import { useAuth } from "../features/iam/AuthContext";
import {
  fetchMyAccount,
  updateMyContact,
  fetchMyRequests,
  requestTransfer,
  fetchMyMedia,
  uploadMediaAsset,
  deleteMediaAsset,
  openMediaAsset,
  MyAccountData,
  MyRequestRow,
  MediaAssetDto,
} from "../features/portal/api";

// "Contul meu" (4.5.1 R14-R19, R44-R48) — SPV al unui cont de stakeholder extern
// (SPORTIV/CLUB/FEDERATIE/CNFPA), cu secțiuni condiționate pe rol: date de contact
// editabile, istoricul propriu, documente reutilizabile, și acțiuni specifice rolului
// (ex. inițiere transfer pentru un sportiv).
export default function MyAccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<MyAccountData | null>(null);
  const [requests, setRequests] = useState<MyRequestRow[]>([]);
  const [media, setMedia] = useState<MediaAssetDto[]>([]);
  const [name, setName] = useState(user?.name || "");
  const [savingContact, setSavingContact] = useState(false);
  const [contactMsg, setContactMsg] = useState<string | null>(null);
  const [transferClubId, setTransferClubId] = useState("");
  const [transferType, setTransferType] = useState<"PERMANENT" | "TEMPORARY">("PERMANENT");
  const [transferMsg, setTransferMsg] = useState<string | null>(null);

  function load() {
    fetchMyAccount().then(setAccount).catch(() => setAccount(null));
    fetchMyRequests().then(setRequests).catch(() => setRequests([]));
    fetchMyMedia().then(setMedia).catch(() => setMedia([]));
  }
  useEffect(load, []);

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    setSavingContact(true);
    setContactMsg(null);
    try {
      await updateMyContact(name);
      setContactMsg("Date de contact actualizate.");
    } finally {
      setSavingContact(false);
    }
  }

  async function handleTransferRequest(e: React.FormEvent) {
    e.preventDefault();
    setTransferMsg(null);
    try {
      await requestTransfer(transferClubId, transferType);
      setTransferMsg("Cerere de transfer înregistrată.");
      setTransferClubId("");
      load();
    } catch (err: any) {
      setTransferMsg(err?.response?.data?.error || "Cererea de transfer a eșuat");
    }
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    await uploadMediaAsset(file, true);
    load();
  }

  if (!account) return <AppShell title="Contul meu" subtitle="Se încarcă..."><div /></AppShell>;

  return (
    <AppShell title="Contul meu" subtitle="Datele tale de contact, istoricul propriu și documentele reutilizabile (SPV)">
      {!account.linked && (
        <Card style={{ marginBottom: 16, background: T.warnTint }}>
          <p style={{ color: T.warn, margin: 0, fontSize: 13.5 }}>
            Contul tău nu este încă asociat unei entități de domeniu — contactează un administrator pentru asociere din panoul de Utilizatori.
          </p>
        </Card>
      )}

      <Card id="my-account-contact-card" style={{ marginBottom: 16 }}>
        <SectionHeader title="Datele mele de contact" />
        <form onSubmit={handleSaveContact} style={{ display: "flex", gap: 12, alignItems: "end" }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Nume</FieldLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Email (identificator unic, neschimbabil)</FieldLabel>
            <input value={user?.email || ""} disabled style={{ width: "100%", opacity: 0.6 }} />
          </div>
          <Button type="submit" style={{ opacity: savingContact ? 0.6 : 1 }}>{savingContact ? "Se salvează..." : "Salvează"}</Button>
        </form>
        {contactMsg && <p style={{ color: T.success, fontSize: 13, marginTop: 8 }}>{contactMsg}</p>}
      </Card>

      {account.role === "SPORTIV" && account.athlete && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader title={`${account.athlete.firstName} ${account.athlete.lastName}`} />
            <p style={{ fontSize: 13, color: T.ink3, marginTop: -8 }}>
              Club: {account.athlete.club?.name || "—"} · Viză medicală: {account.athlete.medicalVisaExpiresAt ? new Date(account.athlete.medicalVisaExpiresAt).toLocaleDateString("ro-RO") : "nesetată"}
            </p>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.ink3, marginBottom: 8 }}>ISTORIC REZULTATE</div>
              {account.athlete.results.map((r) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${T.line2}` }}>
                  <span>{r.competitionName} — {new Date(r.date).toLocaleDateString("ro-RO")}</span>
                  <span style={{ fontWeight: 700 }}>{r.result} {r.medal && <Award size={13} style={{ verticalAlign: "middle", marginLeft: 4 }} />}</span>
                </div>
              ))}
              {account.athlete.results.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun rezultat înregistrat încă.</p>}
            </div>
          </Card>

          <Card id="my-account-transfer-card" style={{ marginBottom: 16 }}>
            <SectionHeader title="Inițiază transfer" />
            <form onSubmit={handleTransferRequest} style={{ display: "flex", gap: 12, alignItems: "end" }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Club destinație (ID)</FieldLabel>
                <input value={transferClubId} onChange={(e) => setTransferClubId(e.target.value)} placeholder="id-ul clubului" required style={{ width: "100%" }} />
              </div>
              <div>
                <FieldLabel>Tip transfer</FieldLabel>
                <select value={transferType} onChange={(e) => setTransferType(e.target.value as any)}>
                  <option value="PERMANENT">Definitiv</option>
                  <option value="TEMPORARY">Temporar</option>
                </select>
              </div>
              <Button type="submit" style={{ display: "flex", alignItems: "center", gap: 6 }}><ArrowRightLeft size={14} /> Trimite cererea</Button>
            </form>
            {transferMsg && <p style={{ fontSize: 13, marginTop: 8, color: T.ink2 }}>{transferMsg}</p>}
            {account.athlete.transfers.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {account.athlete.transfers.map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0" }}>
                    <span>{t.transferType === "PERMANENT" ? "Definitiv" : "Temporar"} — {new Date(t.createdAt).toLocaleDateString("ro-RO")}</span>
                    <Pill color={t.status === "APPROVED" ? T.success : t.status === "REJECTED" ? T.danger : T.warn} bg={t.status === "APPROVED" ? T.successTint : t.status === "REJECTED" ? T.dangerTint : T.warnTint}>
                      {t.status === "APPROVED" ? "Aprobat" : t.status === "REJECTED" ? "Respins" : "În așteptare"}
                    </Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {account.role === "CLUB" && account.club && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHeader title={`${account.club.name} — sportivi afiliați`} />
          {account.club.athletes.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${T.line2}` }}>
              <span>{a.firstName} {a.lastName}</span>
              <Pill color={a.status === "ACTIVE" ? T.success : T.ink3} bg={a.status === "ACTIVE" ? T.successTint : T.line2}>{a.status}</Pill>
            </div>
          ))}
          {account.club.athletes.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun sportiv afiliat.</p>}
        </Card>
      )}

      {account.role === "FEDERATIE" && account.federation && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHeader title={`${account.federation.name} — cluburi afiliate`} />
          {account.federation.clubs.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${T.line2}` }}>
              <span>{c.name} {c.county && `(${c.county})`}</span>
              <Pill color={c.status === "ACTIVE" ? T.success : T.ink3} bg={c.status === "ACTIVE" ? T.successTint : T.line2}>{c.status}</Pill>
            </div>
          ))}
          {account.federation.clubs.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun club afiliat.</p>}
        </Card>
      )}

      {account.role === "CNFPA" && account.cnfpaStats && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHeader title="Activitate CNFPA" />
          <div style={{ display: "flex", gap: 30 }}>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{account.cnfpaStats.coursesAuthored}</div><div style={{ fontSize: 12, color: T.ink3 }}>Cursuri</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{account.cnfpaStats.totalEnrollments}</div><div style={{ fontSize: 12, color: T.ink3 }}>Înscrieri</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{account.cnfpaStats.totalCertificates}</div><div style={{ fontSize: 12, color: T.ink3 }}>Certificate emise</div></div>
          </div>
          <Button variant="ghost" style={{ marginTop: 14 }} onClick={() => navigate("/lms")}>Deschide platforma CNFPA (LMS)</Button>
        </Card>
      )}

      <Card id="my-account-history-card" style={{ marginBottom: 16 }}>
        <SectionHeader title="Istoricul cererilor mele" />
        {requests.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${T.line2}` }}>
            <span>{r.registryNumber} — {r.category}</span>
            <Pill color={T.ink3} bg={T.line2}>{r.status}</Pill>
          </div>
        ))}
        {requests.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Nicio cerere depusă încă.</p>}
      </Card>

      <Card id="my-account-documents-card">
        <SectionHeader title="Documentele mele (SPV)" />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: T.brand, cursor: "pointer", marginBottom: 14 }}>
          <Upload size={15} /> Încarcă document reutilizabil
          <input type="file" style={{ display: "none" }} onChange={(e) => handleUpload(e.target.files?.[0] || null)} />
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {media.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${T.line2}` }}>
              <button onClick={() => openMediaAsset(m)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: T.ink2, padding: 0 }}>
                <FileText size={14} /> {m.filename}
              </button>
              <button onClick={() => deleteMediaAsset(m.id).then(load)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {media.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun document încărcat încă.</p>}
        </div>
      </Card>
    </AppShell>
  );
}
