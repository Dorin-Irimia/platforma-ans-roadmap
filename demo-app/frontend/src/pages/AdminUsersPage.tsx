import { useEffect, useState } from "react";
import { fetchUsers, setUserActive } from "../features/iam/api";

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
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h2>Administrare utilizatori</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <table border={1} cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Nume</th>
            <th>Rol</th>
            <th>2FA</th>
            <th>Activ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.name}</td>
              <td>{u.role}</td>
              <td>{u.twoFactorEnabled ? "Da" : "Nu"}</td>
              <td>{u.isActive ? "Activ" : "Blocat"}</td>
              <td>
                <button onClick={() => toggleActive(u)}>{u.isActive ? "Blochează" : "Deblochează"}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
