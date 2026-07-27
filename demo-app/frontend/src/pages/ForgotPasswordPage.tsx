import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../features/iam/api";
import { Card, Button, FieldLabel, LogoMark } from "../components/ui";
import { T, FONT, RADIUS } from "../theme";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      // Mesajul e mereu generic (nu confirmă/infirmă existența contului) — vezi
      // backend-ul (iam/routes.ts), care întoarce același răspuns indiferent de rezultat.
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Nu am putut trimite linkul de resetare");
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
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>Ai uitat parola?</h2>
        <p style={{ color: T.ink3, fontSize: 13.5, margin: "0 0 24px" }}>
          Introdu adresa de email a contului — îți trimitem un link de resetare a parolei.
        </p>

        {sent ? (
          <>
            <p style={{ color: T.success, fontSize: 13.5 }}>
              Dacă adresa este înregistrată, vei primi în scurt timp un email cu instrucțiuni de resetare a parolei.
            </p>
            <p style={{ fontSize: 13, color: T.ink3, marginTop: 18 }}>
              <Link to="/login">Înapoi la autentificare</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Email</FieldLabel>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} autoFocus />
            </div>
            {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
            <Button type="submit" style={{ width: "100%", marginTop: 6, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Se trimite..." : "Trimite linkul de resetare"}
            </Button>
            <p style={{ fontSize: 13, color: T.ink3, marginTop: 18, textAlign: "center" }}>
              <Link to="/login">← Înapoi la autentificare</Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
