import { useEffect, useState } from "react";
import { fetchUsers, setUserActive } from "../features/iam/api";
import { PageShell, Card, SectionHeader, Pill, RolePill, Button } from "../components/ui";
import { T } from "../theme";

interface UserRow {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
}

// Scenariul 4/5 — panou administrare: listă utilizatori + blocare/deblocare instant.
export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers().then(setUsers).catch((e) => setError(e?.response?.data?.error || "Eroare la încărcare"));
  }, []);

  async function toggleActive(u: UserRow) {
    const updated = await setUserActive(u.id, !u.isActive);
    setUsers((prev) => prev.map((row) => (row.id === u.id ? { ...row, isActive: updated.isActive } : row)));
  }

  return (
    <PageShell title="Administrare utilizatori" subtitle="Scenariul 4 — Securitate / IAM">
      <Card padded={false}>
        <div style={{ padding: "20px 20px 0" }}>
          <SectionHeader title={`${users.length} conturi`} />
        </div>
        {error && <p style={{ color: T.danger, padding: "0 20px" }}>{error}</p>}
        <table>
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Email</th>
              <th>Nume</th>
              <th>Rol</th>
              <th>2FA</th>
              <th>Status</th>
              <th style={{ paddingRight: 20 }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ paddingLeft: 20, fontWeight: 600 }}>{u.email}</td>
                <td>{u.name || "—"}</td>
                <td><RolePill role={u.role} /></td>
                <td>{u.twoFactorEnabled ? <Pill color={T.success} bg={T.successTint}>Activ</Pill> : <Pill>Inactiv</Pill>}</td>
                <td>
                  {u.isActive ? (
                    <Pill color={T.success} bg={T.successTint}>Activ</Pill>
                  ) : (
                    <Pill color={T.danger} bg={T.dangerTint}>Blocat</Pill>
                  )}
                </td>
                <td style={{ paddingRight: 20 }}>
                  <Button variant={u.isActive ? "danger" : "primary"} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => toggleActive(u)}>
                    {u.isActive ? "Blochează" : "Deblochează"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
