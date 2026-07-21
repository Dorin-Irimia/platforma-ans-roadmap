import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../features/iam/AuthContext";
import { T } from "../theme";
import { AppShell } from "./AppShell";
import { Card } from "./ui";

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
        <span style={{ color: T.ink3 }}>Se încarcă...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return (
      <AppShell title="Acces interzis" subtitle="Nu ai permisiunile necesare pentru această secțiune">
        <Card>
          <p style={{ margin: 0, color: T.ink2 }}>
            Contul tău are rolul <strong>{user.role.replace(/_/g, " ")}</strong>, care nu include accesul la această pagină.
            Contactează un administrator dacă ai nevoie de drepturi suplimentare.
          </p>
        </Card>
      </AppShell>
    );
  }

  return <>{children}</>;
}
