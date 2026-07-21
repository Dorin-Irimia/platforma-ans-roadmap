import { useNavigate } from "react-router-dom";
import { ShieldCheck, Users as UsersIcon } from "lucide-react";
import { RolePill } from "../../ui";
import { T } from "../../../theme";
import { useAuth } from "../../../features/iam/AuthContext";

export function AccountSummaryWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user && ["SUPER_ADMIN", "ADMIN_INSTITUTIE"].includes(user.role);

  if (!user) return null;

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{user.name || user.email}</div>
      <div style={{ fontSize: 12.5, color: T.ink3, marginBottom: 8 }}>{user.email}</div>
      <RolePill role={user.role} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
        <button
          onClick={() => navigate("/security")}
          style={{ display: "flex", alignItems: "center", gap: 8, background: T.line2, border: "none", borderRadius: 10, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, color: T.ink2, cursor: "pointer", textAlign: "left" }}
        >
          <ShieldCheck size={15} /> Securitate cont
        </button>
        {isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            style={{ display: "flex", alignItems: "center", gap: 8, background: T.line2, border: "none", borderRadius: 10, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, color: T.ink2, cursor: "pointer", textAlign: "left" }}
          >
            <UsersIcon size={15} /> Administrare utilizatori
          </button>
        )}
      </div>
    </div>
  );
}
