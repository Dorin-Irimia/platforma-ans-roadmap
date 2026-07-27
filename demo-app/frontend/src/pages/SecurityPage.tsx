import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Monitor } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, SectionHeader, Button, FieldLabel, Pill } from "../components/ui";
import { useToast } from "../components/ToastProvider";
import { T } from "../theme";
import { describeUserAgent } from "../lib/userAgent";
import { useAuth } from "../features/iam/AuthContext";
import {
  enroll2FA,
  verify2FA,
  disable2FA,
  fetch2FAFactors,
  TotpFactor,
  fetchEmailOtpStatus,
  enrollEmailOtp,
  disableEmailOtp,
  fetchMySessions,
  revokeMySession,
  SessionRow,
} from "../features/iam/api";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "chiar acum";
  if (minutes < 60) return `acum ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `acum ${hours} h`;
  const days = Math.round(hours / 24);
  return `acum ${days} zile`;
}

// Sesiuni active + revocare per-dispozitiv — distinct de 2FA de mai sus: aici utilizatorul
// vede fiecare login reușit (dispozitiv/IP/ultima activitate) și poate deconecta de la
// distanță un dispozitiv anume, fără să-și schimbe parola sau să dezactiveze tot contul.
function SessionsCard() {
  const toast = useToast();
  const { signOut } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  function load() {
    fetchMySessions()
      .then(setSessions)
      .catch((e) => setError(e?.response?.data?.error || "Eroare la încărcare"));
  }

  useEffect(load, []);

  async function handleRevoke(s: SessionRow) {
    if (!window.confirm(s.isCurrent ? "Aceasta e sesiunea curentă — revocarea te va deconecta acum. Continui?" : "Deconectezi acest dispozitiv?")) return;
    setRevokingId(s.id);
    try {
      await revokeMySession(s.id);
      if (s.isCurrent) {
        signOut();
        return;
      }
      toast.success("Dispozitivul a fost deconectat.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Revocare eșuată");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Card style={{ maxWidth: 560, marginTop: 20 }}>
      <SectionHeader title="Sesiuni active" />
      {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
      {sessions === null && <p style={{ color: T.ink3, fontSize: 13 }}>Se încarcă...</p>}
      {sessions !== null && sessions.length === 0 && (
        <p style={{ color: T.ink3, fontSize: 13 }}>Nicio sesiune înregistrată încă.</p>
      )}
      {sessions !== null && sessions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                border: `1px solid ${T.line}`,
                borderRadius: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Monitor size={16} color={T.ink3} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    {describeUserAgent(s.userAgent)}
                    {s.isCurrent && <Pill color={T.success} bg={T.successTint}>Sesiunea curentă</Pill>}
                  </div>
                  <div style={{ fontSize: 12, color: T.ink3 }}>
                    {s.ipAddress || "IP necunoscut"} · activ {formatRelativeTime(s.lastSeenAt)}
                  </div>
                </div>
              </div>
              <Button
                variant="danger"
                style={{ padding: "6px 12px", fontSize: 12, opacity: revokingId === s.id ? 0.7 : 1 }}
                onClick={() => handleRevoke(s)}
              >
                Deconectează
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EmailOtpCard() {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchEmailOtpStatus()
      .then(setEnabled)
      .catch((e) => setError(e?.response?.data?.error || "Eroare la încărcare"));
  }

  useEffect(load, []);

  async function handleEnroll() {
    setError(null);
    try {
      await enrollEmailOtp();
      toast.success("Email OTP a fost activat ca al doilea factor.");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Activare eșuată");
    }
  }

  async function handleDisable() {
    setError(null);
    try {
      await disableEmailOtp();
      toast.success("Email OTP a fost dezactivat.");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Dezactivare eșuată");
    }
  }

  return (
    <Card style={{ maxWidth: 560, marginTop: 20 }}>
      <SectionHeader title="Autentificare în doi factori (Email OTP)" />
      {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}

      {enabled === null && <p style={{ color: T.ink3, fontSize: 13 }}>Se încarcă...</p>}

      {enabled === true && (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Pill color={T.success} bg={T.successTint}>
            <ShieldCheck size={13} /> Activ
          </Pill>
          <Button variant="danger" onClick={handleDisable} style={{ padding: "8px 14px", fontSize: 13 }}>
            <ShieldOff size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Dezactivează Email OTP
          </Button>
        </div>
      )}

      {enabled === false && (
        <div>
          <Pill style={{ marginBottom: 12 }}>Inactiv</Pill>
          <p style={{ color: T.ink2, fontSize: 13 }}>
            Un cod de unică folosință va fi trimis pe adresa de email a contului la fiecare autentificare, ca al doilea canal 2FA (alături de aplicația de autentificare).
          </p>
          <Button onClick={handleEnroll} style={{ padding: "8px 14px", fontSize: 13 }}>Activează Email OTP</Button>
        </div>
      )}
    </Card>
  );
}

export default function SecurityPage() {
  const toast = useToast();
  const [factors, setFactors] = useState<TotpFactor[] | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch2FAFactors()
      .then(setFactors)
      .catch((e) => setError(e?.response?.data?.error || "Eroare la încărcare"));
  }

  useEffect(load, []);

  const verifiedFactor = factors?.find((f) => f.status === "verified");

  async function startEnroll() {
    setError(null);
    try {
      const data = await enroll2FA();
      setFactorId(data.factorId);
      setQrCodeSvg(data.qrCodeSvg);
      setSecret(data.secret);
      setEnrolling(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Activare eșuată");
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await verify2FA(factorId!, code);
      setEnrolling(false);
      setQrCodeSvg(null);
      setCode("");
      toast.success("Autentificarea în doi factori a fost activată.");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Cod invalid");
    }
  }

  async function handleDisable(id: string) {
    setError(null);
    try {
      await disable2FA(id);
      toast.success("Autentificarea în doi factori a fost dezactivată.");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Dezactivare eșuată");
    }
  }

  return (
    <AppShell title="Securitate" subtitle="Autentificare în doi factori (2FA) pentru contul tău">
      <Card style={{ maxWidth: 560 }}>
        <SectionHeader title="Autentificare în doi factori (TOTP)" />
        {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}

        {factors === null && <p style={{ color: T.ink3, fontSize: 13 }}>Se încarcă...</p>}

        {factors !== null && verifiedFactor && !enrolling && (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Pill color={T.success} bg={T.successTint}>
              <ShieldCheck size={13} /> Activ
            </Pill>
            <Button variant="danger" onClick={() => handleDisable(verifiedFactor.id)} style={{ padding: "8px 14px", fontSize: 13 }}>
              <ShieldOff size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Dezactivează 2FA
            </Button>
          </div>
        )}

        {factors !== null && !verifiedFactor && !enrolling && (
          <div>
            <Pill style={{ marginBottom: 12 }}>Inactiv</Pill>
            <p style={{ color: T.ink2, fontSize: 13 }}>
              Adaugă un al doilea factor de autentificare cu o aplicație precum Google Authenticator sau Microsoft Authenticator.
            </p>
            <Button id="security-enable-2fa-btn" onClick={startEnroll} style={{ padding: "8px 14px", fontSize: 13 }}>Activează 2FA</Button>
          </div>
        )}

        {enrolling && (
          <form onSubmit={confirmEnroll} style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center", padding: 18, background: T.bgSoft, border: `1px solid ${T.line}`, borderRadius: 14, marginBottom: 18 }}>
              {qrCodeSvg && (
                <img src={qrCodeSvg} alt="Cod QR pentru activare 2FA" style={{ width: 120, height: 120, borderRadius: 12, background: T.card, border: `1px solid ${T.line}`, flexShrink: 0 }} />
              )}
              <div>
                <p style={{ fontSize: 13, color: T.ink2, margin: "0 0 8px" }}>Scanează codul QR din aplicația de autentificare, apoi introdu codul generat.</p>
                {secret && (
                  <p style={{ fontSize: 12, color: T.ink3, margin: 0 }}>
                    Sau introdu manual: <code style={{ fontWeight: 700, color: T.ink }}>{secret}</code>
                  </p>
                )}
              </div>
            </div>
            <div style={{ marginTop: 10, marginBottom: 14, maxWidth: 200 }}>
              <FieldLabel>Cod din aplicație</FieldLabel>
              <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} autoFocus style={{ width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button type="submit" style={{ padding: "8px 14px", fontSize: 13 }}>Confirmă</Button>
              <Button variant="ghost" onClick={() => { setEnrolling(false); setCode(""); }} style={{ padding: "8px 14px", fontSize: 13 }}>Anulează</Button>
            </div>
          </form>
        )}
      </Card>

      <EmailOtpCard />
      <SessionsCard />
    </AppShell>
  );
}
