import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { fetchAuditLog } from "../features/iam/api";
import { AppShell } from "../components/AppShell";
import { Card, SectionHeader, Pill, Button, FieldLabel } from "../components/ui";
import { T } from "../theme";

interface AuditRow {
  id: string;
  action: string;
  resource?: string;
  userId?: string;
  createdAt: string;
  success: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

function formatMetadataValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load(nextOffset: number, append: boolean) {
    fetchAuditLog({
      action: actionFilter || undefined,
      resource: resourceFilter || undefined,
      success: statusFilter === "" ? undefined : statusFilter === "true",
      from: from || undefined,
      to: to || undefined,
      limit: PAGE_SIZE,
      offset: nextOffset,
    })
      .then((data) => {
        setLogs((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === PAGE_SIZE);
        setOffset(nextOffset);
        setError(null);
      })
      .catch((e) => setError(e?.response?.data?.error || "Eroare la încărcare"));
  }

  useEffect(() => {
    load(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="Jurnal de audit" subtitle="Istoric imuabil al acțiunilor din sistem — autentificări, modificări, acces la resurse">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <FieldLabel>Acțiune conține</FieldLabel>
            <input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder="ex: LOGIN_FAILED" style={{ width: 180 }} />
          </div>
          <div>
            <FieldLabel>Resursă conține</FieldLabel>
            <input value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} placeholder="ex: user:" style={{ width: 160 }} />
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ width: 130 }}>
              <option value="">Toate</option>
              <option value="true">OK</option>
              <option value="false">Eșuat</option>
            </select>
          </div>
          <div>
            <FieldLabel>De la</FieldLabel>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Până la</FieldLabel>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button id="audit-filter-btn" onClick={() => load(0, false)}>Filtrează</Button>
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ padding: "20px 20px 0" }}>
          <SectionHeader title={`${logs.length} evenimente`} />
        </div>
        {error && <p style={{ color: T.danger, padding: "0 20px" }}>{error}</p>}
        <table>
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}></th>
              <th>Data</th>
              <th>Acțiune</th>
              <th>Resursă</th>
              <th>Utilizator</th>
              <th>IP</th>
              <th style={{ paddingRight: 20 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const hasDetails = !!l.userAgent || (l.metadata && Object.keys(l.metadata).length > 0);
              const expanded = expandedId === l.id;
              return (
                <Fragment key={l.id}>
                  <tr style={{ cursor: hasDetails ? "pointer" : "default" }} onClick={() => hasDetails && setExpandedId(expanded ? null : l.id)}>
                    <td style={{ paddingLeft: 20, width: 20 }}>
                      {hasDetails && (expanded ? <ChevronDown size={13} color={T.ink3} /> : <ChevronRight size={13} color={T.ink3} />)}
                    </td>
                    <td>{new Date(l.createdAt).toLocaleString("ro-RO")}</td>
                    <td style={{ fontWeight: 600 }}>{l.action}</td>
                    <td>{l.resource || "—"}</td>
                    <td>{l.userId || "—"}</td>
                    <td style={{ fontSize: 12, color: T.ink3 }}>{l.ipAddress || "—"}</td>
                    <td style={{ paddingRight: 20, textAlign: "right" }}>
                      {l.success ? (
                        <Pill color={T.success} bg={T.successTint}>OK</Pill>
                      ) : (
                        <Pill color={T.danger} bg={T.dangerTint}>Eșuat</Pill>
                      )}
                    </td>
                  </tr>
                  {expanded && hasDetails && (
                    <tr>
                      <td></td>
                      <td colSpan={6} style={{ paddingBottom: 14, paddingRight: 20 }}>
                        <div style={{ background: T.bgSoft, borderRadius: 10, padding: 12, fontSize: 12.5 }}>
                          {l.userAgent && (
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ color: T.ink3 }}>Browser: </span>
                              {l.userAgent}
                            </div>
                          )}
                          {l.metadata &&
                            Object.entries(l.metadata).map(([k, v]) => (
                              <div key={k} style={{ marginBottom: 4 }}>
                                <span style={{ color: T.ink3 }}>{k}: </span>
                                {formatMetadataValue(v)}
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 20, color: T.ink3 }}>Niciun eveniment găsit.</td>
              </tr>
            )}
          </tbody>
        </table>
        {hasMore && (
          <div style={{ padding: 20, textAlign: "center" }}>
            <Button variant="ghost" onClick={() => load(offset + PAGE_SIZE, true)} style={{ padding: "8px 16px", fontSize: 13 }}>
              Încarcă mai multe
            </Button>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
