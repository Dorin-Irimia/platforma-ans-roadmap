import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../features/iam/api";
import { Card, Button, FieldLabel } from "../components/ui";
import { T } from "../theme";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register(email, password, name);
      navigate("/login");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Înregistrare eșuată");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 360, padding: 28 }}>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Cont nou</h2>
        <p style={{ color: T.ink3, fontSize: 13, marginTop: 0, marginBottom: 22 }}>Scenariul 4 — Securitate / IAM</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Nume</FieldLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Email</FieldLabel>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Parolă</FieldLabel>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%" }} />
          </div>
          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
          <Button type="submit" style={{ width: "100%", marginTop: 6 }}>Creează cont</Button>
        </form>
        <p style={{ fontSize: 13, color: T.ink3, marginTop: 18, textAlign: "center" }}>
          Ai deja cont? <Link to="/login">Autentifică-te</Link>
        </p>
      </Card>
    </div>
  );
}
