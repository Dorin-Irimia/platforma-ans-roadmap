import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { fetchAuthPolicy, AuthPolicy } from "../features/iam/api";
import { describePasswordPolicy, validatePasswordAgainstPolicy } from "../features/iam/passwordPolicy";
import { Card, Button, FieldLabel, LogoMark } from "../components/ui";
import { T, FONT, RADIUS } from "../theme";

// Setarea parolei noi după click pe linkul de recuperare — tipar identic cu
// AcceptInvitePage.tsx (linkul Supabase de tip "recovery" stabilește sesiunea automat
// din fragmentul URL, detectSessionInUrl; apoi setăm parola direct cu updateUser()).
export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [policy, setPolicy] = useState<AuthPolicy | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setValidSession(!!data.session);
      setChecking(false);
    });
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
    if (password !== confirm) {
      setError("Parolele nu coincid.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      setError(err?.message || "Nu am putut seta parola");
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
        <p style={{ color: T.ink3, fontSize: 13.5, marginTop: 0, marginBottom: 24 }}>Resetează-ți parola</p>

        {checking && <p style={{ color: T.ink3, fontSize: 13 }}>Se verifică linkul de resetare...</p>}

        {!checking && !validSession && !done && (
          <>
            <p style={{ color: T.danger, fontSize: 13 }}>Link invalid sau expirat.</p>
            <p style={{ fontSize: 13, color: T.ink3 }}>
              <Link to="/forgot-password">Trimite un link nou</Link>
            </p>
          </>
        )}

        {!checking && validSession && !done && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Parolă nouă</FieldLabel>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%" }} autoFocus />
              {policy && (
                <p style={{ fontSize: 12, color: T.ink3, marginTop: 6 }}>
                  {describePasswordPolicy(policy).replace(/^./, (c) => c.toUpperCase())}
                </p>
              )}
            </div>
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Confirmă parola</FieldLabel>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required style={{ width: "100%" }} />
            </div>
            {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
            <Button type="submit" style={{ width: "100%", marginTop: 6, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Se salvează..." : "Setează parola"}
            </Button>
          </form>
        )}

        {done && <p style={{ color: T.success, fontSize: 13 }}>Parolă setată — te redirecționăm la autentificare...</p>}
      </Card>
    </div>
  );
}
