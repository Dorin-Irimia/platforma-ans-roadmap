import { useEffect, useState } from "react";
import { fetchAuditLog } from "../features/iam/api";
import { PageShell, Card, SectionHeader, Pill } from "../components/ui";
import { T } from "../theme";

interface AuditRow {
  id: string;
  action: string;
  resource?: string;
  userId?: string;
  createdAt: string;
  success: boolean;
}

// Scenariul 4 — jurnal de audit cu filtrare (client-side, simplu, pentru demo).
export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);

  useEffect(() => {
    fetchAuditLog().then(setLogs).catch(() => setLogs([]));
  }, []);

  return (
    <PageShell title="Jurnal de audit" subtitle="Scenariul 4 — Securitate / IAM">
      <Card padded={false}>
        <div style={{ padding: "20px 20px 0" }}>
          <SectionHeader title={`${logs.length} evenimente`} />
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Data</th>
              <th>Acțiune</th>
              <th>Resursă</th>
              <th>Utilizator</th>
              <th style={{ paddingRight: 20 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td style={{ paddingLeft: 20 }}>{new Date(l.createdAt).toLocaleString("ro-RO")}</td>
                <td style={{ fontWeight: 600 }}>{l.action}</td>
                <td>{l.resource || "—"}</td>
                <td>{l.userId || "—"}</td>
                <td style={{ paddingRight: 20 }}>
                  {l.success ? (
                    <Pill color={T.success} bg={T.successTint}>OK</Pill>
                  ) : (
                    <Pill color={T.danger} bg={T.dangerTint}>Eșuat</Pill>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
