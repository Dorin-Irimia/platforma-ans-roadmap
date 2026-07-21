import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  fetchUsers,
  setUserActive,
  setUserRole,
  inviteEmployee,
  deleteUser,
  fetchGroups,
  createGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  fetchAuthPolicy,
  updateAuthPolicy,
  rejectExpiredPending,
  GroupRow,
  AuthPolicy,
} from "../features/iam/api";
import { AppShell } from "../components/AppShell";
import { Card, SectionHeader, Pill, Button, FieldLabel, ROLE_COLORS } from "../components/ui";
import { T } from "../theme";

interface UserRow {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive: boolean;
  pendingApprovalSince?: string | null;
  pendingTooLong?: boolean;
}

const ROLES = [
  "SUPER_ADMIN",
  "ADMIN_INSTITUTIE",
  "MODERATOR",
  "EVALUATOR",
  "AUTOR",
  "CO_AUTOR",
  "UTILIZATOR_STANDARD",
];

// Select nativ restilizat ca pastilă colorată (după rol) — păstrează schimbarea
// instantă de rol (onChange), doar arată ca RolePill în loc de un dropdown simplu.
function RoleSelect({ value, onChange, id }: { value: string; onChange: (role: string) => void; id?: string }) {
  const style = ROLE_COLORS[value] || { color: T.ink3, bg: T.line2 };
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        border: "none",
        borderRadius: 999,
        padding: "4px 22px 4px 10px",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color: style.color,
        background: style.bg,
        cursor: "pointer",
      }}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("UTILIZATOR_STANDARD");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupMemberPick, setGroupMemberPick] = useState<Record<string, string>>({});

  const [policy, setPolicy] = useState<AuthPolicy | null>(null);
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  function loadUsers() {
    fetchUsers().then(setUsers).catch((e) => setError(e?.response?.data?.error || "Eroare la încărcare"));
  }
  function loadGroups() {
    fetchGroups().then(setGroups).catch(() => {});
  }

  useEffect(() => {
    loadUsers();
    loadGroups();
    fetchAuthPolicy().then(setPolicy).catch(() => {});
  }, []);

  async function toggleActive(u: UserRow) {
    const updated = await setUserActive(u.id, !u.isActive);
    setUsers((prev) => prev.map((row) => (row.id === u.id ? { ...row, isActive: updated.isActive } : row)));
  }

  async function changeRole(u: UserRow, role: string) {
    const updated = await setUserRole(u.id, role);
    setUsers((prev) => prev.map((row) => (row.id === u.id ? { ...row, role: updated.role } : row)));
  }

  async function handleDelete(u: UserRow) {
    if (!window.confirm(`Ștergi definitiv contul ${u.email}? Acțiunea nu poate fi anulată.`)) return;
    await deleteUser(u.id);
    setUsers((prev) => prev.filter((row) => row.id !== u.id));
  }

  const pendingTooLongCount = users.filter((u) => u.pendingTooLong).length;

  async function handleRejectExpired() {
    if (!window.confirm(`Respingi definitiv cele ${pendingTooLongCount} conturi rămase în așteptare peste termen? Acțiunea nu poate fi anulată.`)) return;
    await rejectExpiredPending();
    loadUsers();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteMsg(null);
    setInviting(true);
    try {
      await inviteEmployee(inviteEmail, inviteName || undefined, inviteRole);
      setInviteMsg("Invitație trimisă pe email.");
      setInviteEmail("");
      setInviteName("");
      setInviteRole("UTILIZATOR_STANDARD");
      loadUsers();
    } catch (err: any) {
      setInviteError(err?.response?.data?.error || "Invitație eșuată");
    } finally {
      setInviting(false);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await createGroup(newGroupName.trim());
    setNewGroupName("");
    loadGroups();
  }

  async function handleAddMember(groupId: string) {
    const userId = groupMemberPick[groupId];
    if (!userId) return;
    await addGroupMember(groupId, userId);
    setGroupMemberPick((prev) => ({ ...prev, [groupId]: "" }));
    loadGroups();
  }

  async function handleSavePolicy(e: React.FormEvent) {
    e.preventDefault();
    if (!policy) return;
    setSavingPolicy(true);
    setPolicyMsg(null);
    try {
      const updated = await updateAuthPolicy(policy);
      setPolicy(updated);
      setPolicyMsg("Politică salvată.");
    } catch (e: any) {
      setPolicyMsg(e?.response?.data?.error || "Salvare eșuată");
    } finally {
      setSavingPolicy(false);
    }
  }

  return (
    <AppShell title="Administrare utilizatori" subtitle="Gestionare conturi, roluri, grupuri și politici de acces la sistem">
      <Card padded={false} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
          <SectionHeader title={`${users.length} conturi`} />
          <div style={{ display: "flex", gap: 10 }}>
            {pendingTooLongCount > 0 && (
              <Button variant="danger" style={{ padding: "8px 14px", fontSize: 13 }} onClick={handleRejectExpired}>
                Respinge {pendingTooLongCount} conturi expirate
              </Button>
            )}
            <Button id="admin-invite-btn" onClick={() => setInviteOpen((v) => !v)} style={{ padding: "8px 14px", fontSize: 13 }}>
              + Invită angajat
            </Button>
          </div>
        </div>
        {inviteOpen && (
          <div style={{ padding: "12px 20px 0" }}>
            <form onSubmit={handleInvite} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
              <div>
                <FieldLabel>Email</FieldLabel>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required style={{ width: "100%" }} />
              </div>
              <div>
                <FieldLabel>Nume</FieldLabel>
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div>
                <FieldLabel>Rol</FieldLabel>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ width: "100%" }}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" style={{ padding: "8px 14px", fontSize: 13, opacity: inviting ? 0.7 : 1 }}>
                {inviting ? "Se trimite..." : "Trimite invitația"}
              </Button>
            </form>
            <p style={{ marginTop: 8 }}>
              <a onClick={() => setInviteOpen(false)} style={{ cursor: "pointer", fontSize: 12.5 }}>Anulează</a>
            </p>
          </div>
        )}
        {inviteError && <p style={{ color: T.danger, fontSize: 13, padding: "0 20px" }}>{inviteError}</p>}
        {inviteMsg && <p style={{ color: T.success, fontSize: 13, padding: "0 20px" }}>{inviteMsg}</p>}
        {error && <p style={{ color: T.danger, padding: "0 20px" }}>{error}</p>}
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Email</th>
              <th>Nume</th>
              <th>Rol</th>
              <th>Status</th>
              <th style={{ paddingRight: 20 }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, uIdx) => (
              <tr key={u.id}>
                <td style={{ paddingLeft: 20, fontWeight: 600 }}>{u.email}</td>
                <td>{u.name || "—"}</td>
                <td>
                  <RoleSelect id={uIdx === 0 ? "admin-role-select" : undefined} value={u.role} onChange={(role) => changeRole(u, role)} />
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {u.isActive ? (
                      <Pill color={T.success} bg={T.successTint}>Activ</Pill>
                    ) : (
                      <Pill color={T.danger} bg={T.dangerTint}>Blocat</Pill>
                    )}
                    {u.pendingTooLong && <Pill color={T.warn} bg={T.warnTint}>În așteptare expirată</Pill>}
                  </div>
                </td>
                <td style={{ paddingRight: 20, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant={u.isActive ? "danger" : "primary"} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => toggleActive(u)}>
                    {u.isActive ? "Blochează" : "Deblochează"}
                  </Button>
                  <Button variant="ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => handleDelete(u)}>
                    Șterge
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card id="admin-groups-card" style={{ marginBottom: 16 }}>
        <SectionHeader title="Grupuri" />
        <form onSubmit={handleCreateGroup} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Nume grup nou"
            style={{ flex: 1 }}
          />
          <Button type="submit" style={{ padding: "8px 14px", fontSize: 13 }}>Creează grup</Button>
        </form>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((g) => {
            const memberIds = new Set(g.members.map((m) => m.user.id));
            const available = users.filter((u) => !memberIds.has(u.id));
            return (
              <div key={g.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong style={{ fontSize: 13.5 }}>{g.name}</strong>
                  <Button variant="ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => deleteGroup(g.id).then(loadGroups)}>
                    Șterge grup
                  </Button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {g.members.map((m) => (
                    <span
                      key={m.user.id}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.line2, borderRadius: 999, padding: "4px 4px 4px 10px", fontSize: 12.5 }}
                    >
                      {m.user.name || m.user.email}
                      <button
                        onClick={() => removeGroupMember(g.id, m.user.id).then(loadGroups)}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 3, display: "flex", color: T.ink3 }}
                        aria-label="Elimină din grup"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {g.members.length === 0 && <span style={{ fontSize: 12.5, color: T.ink3 }}>Niciun membru încă.</span>}
                </div>
                {available.length > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={groupMemberPick[g.id] || ""}
                      onChange={(e) => setGroupMemberPick((prev) => ({ ...prev, [g.id]: e.target.value }))}
                      style={{ fontSize: 12.5, padding: "5px 8px", flex: 1 }}
                    >
                      <option value="">Adaugă membru...</option>
                      {available.map((u) => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                    <Button variant="ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => handleAddMember(g.id)}>
                      Adaugă
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {groups.length === 0 && <p style={{ fontSize: 13, color: T.ink3, margin: 0 }}>Niciun grup creat încă.</p>}
        </div>
      </Card>

      {policy && (
        <Card id="admin-policy-card">
          <SectionHeader title="Politici de autentificare" />
          <form onSubmit={handleSavePolicy} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Durată sesiune (minute)</FieldLabel>
              <input
                type="number"
                min={1}
                value={policy.sessionMinutes}
                onChange={(e) => setPolicy({ ...policy, sessionMinutes: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <FieldLabel>Lungime minimă parolă</FieldLabel>
              <input
                type="number"
                min={4}
                value={policy.minPasswordLength}
                onChange={(e) => setPolicy({ ...policy, minPasswordLength: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <FieldLabel>Tentative eșuate până la blocare</FieldLabel>
              <input
                type="number"
                min={1}
                value={policy.maxFailedAttempts}
                onChange={(e) => setPolicy({ ...policy, maxFailedAttempts: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <FieldLabel>Durată blocare (minute)</FieldLabel>
              <input
                type="number"
                min={1}
                value={policy.lockoutMinutes}
                onChange={(e) => setPolicy({ ...policy, lockoutMinutes: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <FieldLabel>Zile până la expirare cont în așteptare</FieldLabel>
              <input
                type="number"
                min={1}
                value={policy.pendingApprovalExpiryDays}
                onChange={(e) => setPolicy({ ...policy, pendingApprovalExpiryDays: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.ink2 }}>
              <input
                type="checkbox"
                checked={policy.requireUppercase}
                onChange={(e) => setPolicy({ ...policy, requireUppercase: e.target.checked })}
              />
              Necesită literă mare în parolă
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.ink2 }}>
              <input
                type="checkbox"
                checked={policy.requireNumber}
                onChange={(e) => setPolicy({ ...policy, requireNumber: e.target.checked })}
              />
              Necesită cifră în parolă
            </label>
            <Button type="submit" style={{ padding: "8px 14px", fontSize: 13, opacity: savingPolicy ? 0.7 : 1, justifySelf: "start" }}>
              {savingPolicy ? "Se salvează..." : "Salvează politica"}
            </Button>
          </form>
          {policyMsg && <p style={{ fontSize: 13, color: T.ink2, marginTop: 10, marginBottom: 0 }}>{policyMsg}</p>}
          <p style={{ fontSize: 11.5, color: T.ink3, marginTop: 10, marginBottom: 0 }}>
            Durata sesiunii e aplicată la nivel de aplicație (deconectare automată în browser) — nu modifică durata reală a tokenului Supabase.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
