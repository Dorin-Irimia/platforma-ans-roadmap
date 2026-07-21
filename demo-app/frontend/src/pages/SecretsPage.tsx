import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, SectionHeader, Button, FieldLabel } from "../components/ui";
import { T } from "../theme";
import { fetchSecrets, setSecret, downloadSecretK8sManifest, SecretRow } from "../features/iam/api";

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetchSecrets().then(setSecrets).catch((e) => setError(e?.response?.data?.error || "Eroare la încărcare"));
  }

  useEffect(load, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await setSecret(key, value);
      setMessage(`Secretul „${key}" a fost salvat.`);
      setKey("");
      setValue("");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Salvare eșuată");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Secret Manager" subtitle="Chei API, certificate și credențiale — stocare criptată (AES-256-GCM)">
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title="Secret nou / actualizare" />
        <form onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <FieldLabel>Cheie</FieldLabel>
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="ex: OPENAI_API_KEY" required style={{ width: "100%" }} />
          </div>
          <div>
            <FieldLabel>Valoare</FieldLabel>
            <input value={value} onChange={(e) => setValue(e.target.value)} type="password" required style={{ width: "100%" }} />
          </div>
          <Button id="secrets-save-btn" type="submit" style={{ padding: "8px 14px", fontSize: 13, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Se salvează..." : "Salvează"}
          </Button>
        </form>
        {error && <p style={{ color: T.danger, fontSize: 13, marginBottom: 0 }}>{error}</p>}
        {message && <p style={{ color: T.success, fontSize: 13, marginBottom: 0 }}>{message}</p>}
      </Card>

      <Card padded={false}>
        <div style={{ padding: "20px 20px 0" }}>
          <SectionHeader title={`${secrets.length} secrete stocate`} />
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Cheie</th>
              <th>Actualizat</th>
              <th style={{ paddingRight: 20 }}></th>
            </tr>
          </thead>
          <tbody>
            {secrets.map((s) => (
              <tr key={s.key}>
                <td style={{ paddingLeft: 20, fontWeight: 600, fontFamily: "monospace" }}>{s.key}</td>
                <td>{new Date(s.updatedAt).toLocaleString("ro-RO")}</td>
                <td style={{ paddingRight: 20 }}>
                  <Button
                    variant="ghost"
                    style={{ padding: "6px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                    onClick={() => downloadSecretK8sManifest(s.key)}
                  >
                    <Download size={13} /> Manifest K8s
                  </Button>
                </td>
              </tr>
            ))}
            {secrets.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 20, color: T.ink3 }}>Niciun secret stocat încă.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
