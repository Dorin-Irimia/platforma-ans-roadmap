import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { register, fetchAuthPolicy, AuthPolicy } from "../features/iam/api";
import { describePasswordPolicy, validatePasswordAgainstPolicy } from "../features/iam/passwordPolicy";
import { Card, Button, FieldLabel, LogoMark } from "../components/ui";
import { T, FONT, RADIUS } from "../theme";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [policy, setPolicy] = useState<AuthPolicy | null>(null);
  const [done, setDone] = useState<{ pendingApproval: boolean } | null>(null);

  useEffect(() => {
    fetchAuthPolicy().then(setPolicy).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (policy) {
      const violation = validatePasswordAgainstPolicy(password, policy);
      if (violation) {
        setError(violation);
        return;
      }
    }
    setSubmitting(true);
    try {
      const result = await register(email, password, name);
      setDone({ pendingApproval: result.pendingApproval });
    } catch (err: any) {
      if (!err?.response) {
        setError("Serverul nu răspunde. Verifică dacă backend-ul (docker compose) rulează pe portul 4000.");
      } else {
        const data = err.response.data;
        const message =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.fieldErrors
            ? Object.values(data.error.fieldErrors).flat().join(", ")
            : "Înregistrare eșuată";
        setError(message);
      }
    } finally {
      setSubmitting(false);
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

        {done ? (
          <>
            <p style={{ color: T.ink2, fontSize: 14, marginTop: 12 }}>Cont creat. Înainte de a te putea autentifica:</p>
            <ol style={{ color: T.ink2, fontSize: 13.5, paddingLeft: 20, marginTop: 0 }}>
              <li>Confirmă adresa de email — ți-am trimis un link de confirmare.</li>
              {done.pendingApproval && <li>Un administrator trebuie să aprobe contul.</li>}
            </ol>
            <p style={{ fontSize: 13, color: T.ink3, marginTop: 18, textAlign: "center" }}>
              <Link to="/login">Înapoi la autentificare</Link>
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>Creează cont</h2>
            <p style={{ color: T.ink3, fontSize: 13.5, margin: "0 0 24px" }}>Cont nou pentru portalul ANS</p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Nume complet</FieldLabel>
                <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Email</FieldLabel>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Parolă</FieldLabel>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%" }} />
                <p style={{ fontSize: 12, color: T.ink3, marginTop: 6 }}>
                  {policy ? describePasswordPolicy(policy).replace(/^./, (c) => c.toUpperCase()) : "Se încarcă politica de parolă..."}
                </p>
              </div>
              {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
              <Button type="submit" style={{ width: "100%", marginTop: 6, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Se creează..." : "Creează cont"}
              </Button>
            </form>
            <p style={{ fontSize: 13, color: T.ink3, marginTop: 18, textAlign: "center" }}>
              Ai deja cont? <Link to="/login">Autentifică-te</Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
