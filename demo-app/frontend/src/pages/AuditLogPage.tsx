import { useEffect, useState } from "react";
import { fetchAuditLog } from "../features/iam/api";

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
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h2>Jurnal de audit</h2>
      <table border={1} cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>Data</th>
            <th>Acțiune</th>
            <th>Resursă</th>
            <th>Utilizator</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.createdAt).toLocaleString("ro-RO")}</td>
              <td>{l.action}</td>
              <td>{l.resource}</td>
              <td>{l.userId}</td>
              <td>{l.success ? "OK" : "Eșuat"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
