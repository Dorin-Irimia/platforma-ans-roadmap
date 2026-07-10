import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../features/iam/api";
import { useAuth } from "../features/iam/AuthContext";

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
    <div style={{ maxWidth: 360, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h2>Autentificare</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Parolă</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%" }} />
        </div>
        {needsTwoFactor && (
          <div style={{ marginBottom: 12 }}>
            <label>Cod 2FA</label>
            <input value={twoFactorToken} onChange={(e) => setTwoFactorToken(e.target.value)} style={{ width: "100%" }} />
          </div>
        )}
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">Intră în cont</button>
      </form>
    </div>
  );
}
