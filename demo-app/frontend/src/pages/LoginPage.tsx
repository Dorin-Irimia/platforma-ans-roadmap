import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Fingerprint, Landmark } from "lucide-react";
import { login, startRoeidLogin, requestEmailOtp } from "../features/iam/api";
import { useAuth } from "../features/iam/AuthContext";
import { Card, Button, FieldLabel, LogoMark } from "../components/ui";
import { T, FONT, RADIUS } from "../theme";

// Notă internă (nu apare în UI): eIDAS și RoEID redirecționează spre același conector real
// (RoEID — schema românească notificată la Comisia Europeană ca mijloc eIDAS). Fără acordul
// de colaborare cu ADR + client_id/client_secret emise oficial, autorizarea e respinsă de
// RoEID însuși (client neînregistrat) — vezi jurnalul de audit, acțiunea ROEID_CONNECTOR_ERROR.
const GOV_CONNECTOR_NOTE = "Conector RoEID — redirecționează către sso.beta.roeid.ro.";

function GovConnectorButton({
  stripe,
  icon,
  label,
  onClick,
  disabled,
  id,
}: {
  stripe: React.ReactNode;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={GOV_CONNECTOR_NOTE}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: RADIUS.md,
        border: `1px solid ${T.line}`,
        background: T.card,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: FONT.body,
        fontWeight: 700,
        fontSize: 13.5,
        color: T.ink,
      }}
    >
      <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {stripe}
      </span>
      {icon}
      {label}
    </button>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [twoFactorMethods, setTwoFactorMethods] = useState<("totp" | "email")[]>([]);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { signIn, refresh } = useAuth();
  const navigate = useNavigate();

  function afterLogin(result: { token?: string; user?: { id: string; email: string; role: string } }) {
    if (result.token && result.user) {
      signIn(result.token, result.user);
      refresh().then(() => navigate("/"));
    }
  }

  // Revenire din redirect-ul RoEID: backend-ul întoarce browserul aici cu token-ul în query
  // string (succes) sau cu roeidError (cazul curent, fără client_id înregistrat la ADR).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roeidError = params.get("roeidError");
    const roeidToken = params.get("roeidToken");
    if (roeidError) {
      setError(roeidError);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (roeidToken) {
      const user = {
        id: params.get("roeidUserId") || "",
        email: params.get("roeidEmail") || "",
        role: params.get("roeidRole") || "UTILIZATOR_STANDARD",
      };
      window.history.replaceState({}, "", window.location.pathname);
      afterLogin({ token: roeidToken, user });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password, totpCode || undefined, emailOtpCode || undefined);
      if (result.requiresTwoFactor) {
        setNeedsTwoFactor(true);
        setTwoFactorMethods(result.methods || ["totp"]);
        return;
      }
      afterLogin(result);
    } catch (err: any) {
      if (!err?.response) {
        setError("Serverul nu răspunde. Verifică dacă backend-ul (docker compose) rulează pe portul 4000.");
      } else {
        setError(err.response.data?.error || "Autentificare eșuată");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendEmailOtp() {
    setError(null);
    setSendingEmailOtp(true);
    try {
      const result = await requestEmailOtp(email, password);
      setDevCode(result.devCode);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Nu am putut trimite codul");
    } finally {
      setSendingEmailOtp(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 404, padding: 36, borderRadius: RADIUS.xl, boxShadow: "0 4px 16px rgba(14,17,22,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
          <LogoMark size={30} />
          <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 19, letterSpacing: -0.4 }}>
            Platformă <span style={{ color: T.brand }}>ANS</span>
          </div>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>Bine ai revenit</h2>
        <p style={{ color: T.ink3, fontSize: 13.5, margin: "0 0 24px" }}>Autentifică-te în contul instituțional</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Email</FieldLabel>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <FieldLabel>Parolă</FieldLabel>
              <Link to="/forgot-password" style={{ fontSize: 12.5 }}>Ai uitat parola?</Link>
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%" }} />
          </div>
          {needsTwoFactor && twoFactorMethods.includes("totp") && (
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Cod din aplicația de autentificare</FieldLabel>
              <input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} maxLength={6} style={{ width: "100%" }} autoFocus />
            </div>
          )}
          {needsTwoFactor && twoFactorMethods.includes("email") && (
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Cod primit pe email</FieldLabel>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={emailOtpCode} onChange={(e) => setEmailOtpCode(e.target.value)} maxLength={6} style={{ flex: 1 }} />
                <Button type="button" variant="ghost" onClick={handleSendEmailOtp} style={{ opacity: sendingEmailOtp ? 0.6 : 1, whiteSpace: "nowrap" }}>
                  {sendingEmailOtp ? "Se trimite..." : "Trimite cod"}
                </Button>
              </div>
              {devCode && (
                <p style={{ fontSize: 12, color: T.ink3, marginTop: 6 }}>
                  Cod de test (mediu demo): <strong style={{ color: T.ink, letterSpacing: 1 }}>{devCode}</strong>
                </p>
              )}
            </div>
          )}
          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
          <Button type="submit" style={{ width: "100%", marginTop: 6, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Se verifică..." : needsTwoFactor ? "Confirmă codul" : "Intră în cont"}
          </Button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
          <div style={{ flex: 1, height: 1, background: T.line }} />
          <span style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>sau</span>
          <div style={{ flex: 1, height: 1, background: T.line }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <GovConnectorButton
            id="login-eidas-btn"
            label="Autentificare cu eIDAS"
            icon={<Fingerprint size={17} color="#003399" />}
            stripe={
              <>
                <span style={{ flex: 1, background: "#003399" }} />
                <span style={{ flex: 1, background: "#FFCC00" }} />
              </>
            }
            onClick={startRoeidLogin}
          />
          <GovConnectorButton
            label="Autentificare cu RoEID"
            icon={<Landmark size={17} color="#002B7F" />}
            stripe={
              <>
                <span style={{ flex: 1, background: "#002B7F" }} />
                <span style={{ flex: 1, background: "#FCD116" }} />
                <span style={{ flex: 1, background: "#CE1126" }} />
              </>
            }
            onClick={startRoeidLogin}
          />
        </div>

        <p style={{ fontSize: 13, color: T.ink3, marginTop: 18, textAlign: "center" }}>
          Nu ai cont? <Link to="/register">Creează unul</Link>
        </p>
      </Card>
    </div>
  );
}
