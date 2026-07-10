import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../features/iam/api";
import { useAuth } from "../features/iam/AuthContext";
import { Card, Button, FieldLabel } from "../components/ui";
import { T } from "../theme";

// Scenariul 4 — demonstrează login cu parolă + 2FA opțional.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await login(email, password, twoFactorToken || undefined);
      if (result.requiresTwoFactor) {
        setNeedsTwoFactor(true);
        return;
      }
      if (result.token && result.user) {
        signIn(result.token, result.user);
        navigate("/admin");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Autentificare eșuată");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 360, padding: 28 }}>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Autentificare</h2>
        <p style={{ color: T.ink3, fontSize: 13, marginTop: 0, marginBottom: 22 }}>Scenariul 4 — Securitate / IAM</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Email</FieldLabel>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Parolă</FieldLabel>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%" }} />
          </div>
          {needsTwoFactor && (
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Cod 2FA</FieldLabel>
              <input value={twoFactorToken} onChange={(e) => setTwoFactorToken(e.target.value)} style={{ width: "100%" }} />
            </div>
          )}
          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
          <Button type="submit" style={{ width: "100%", marginTop: 6 }}>Intră în cont</Button>
        </form>
        <p style={{ fontSize: 13, color: T.ink3, marginTop: 18, textAlign: "center" }}>
          Nu ai cont? <Link to="/register">Creează unul</Link>
        </p>
      </Card>
    </div>
  );
}
