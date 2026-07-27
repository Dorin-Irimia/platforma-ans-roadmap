import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PdfPreview } from "../components/PdfPreview";
import { Card, Button, Pill, SectionHeader } from "../components/ui";
import { useAuth } from "../features/iam/AuthContext";
import { T, statusFor } from "../theme";
import {
  fetchRequestDetail,
  DmsRequestDetail,
  DocumentDto,
  fetchCaseTransitions,
  initiateWorkflowCase,
  advanceWorkflowCase,
  WorkflowTransitionDto,
  WorkflowCaseDto,
  addComment,
  fetchTemplates,
  generateResponse,
  signResponse,
  sendResponse,
  uploadAttachments,
  deleteAttachment,
  fetchDocumentBlob,
  createSignaturePlacement,
  ResponseTemplateDto,
} from "../features/dms/api";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function openDocument(doc: DocumentDto) {
  const blob = await fetchDocumentBlob(doc.id);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
}

function AttachmentsCard({ request, onChange }: { request: DmsRequestDetail; onChange: () => void }) {
  const [uploading, setUploading] = useState(false);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (accepted) => {
      if (accepted.length === 0) return;
      setUploading(true);
      try {
        await uploadAttachments(request.id, accepted);
        onChange();
      } finally {
        setUploading(false);
      }
    },
  });

  return (
    <Card id="request-detail-attachments" style={{ marginBottom: 20 }}>
      <SectionHeader title="Atașamente" />
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? T.indigo : T.line}`,
          borderRadius: 12,
          padding: 24,
          textAlign: "center",
          background: isDragActive ? T.indigoTint : T.bgSoft,
          cursor: "pointer",
          marginBottom: 14,
        }}
      >
        <input {...getInputProps()} />
        <UploadCloud size={24} color={T.ink3} style={{ display: "block", margin: "0 auto 6px" }} />
        <p style={{ margin: 0, fontSize: 13, color: T.ink3 }}>
          {uploading ? "Se încarcă..." : isDragActive ? "Lasă fișierele aici..." : "Trage fișiere aici sau dă click pentru a le selecta"}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {request.documents.map((doc) => (
          <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.line2, borderRadius: 8 }}>
            <div style={{ fontSize: 13 }}>
              {doc.kind === "SUBMISSION_PDF" && <Pill color={T.brand} bg={T.brandTint} style={{ marginRight: 8 }}>Cerere depusă</Pill>}
              <span style={{ fontWeight: 600 }}>{doc.filename}</span>
              <span style={{ color: T.ink3 }}> · {formatBytes(doc.sizeBytes)}{doc.pageCount ? ` · ${doc.pageCount} pag.` : ""}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => openDocument(doc)}>Deschide</Button>
              {doc.kind === "ATTACHMENT" && (
                <Button
                  variant="danger"
                  style={{ padding: "5px 10px", fontSize: 12 }}
                  onClick={async () => {
                    await deleteAttachment(doc.id);
                    onChange();
                  }}
                >
                  Șterge
                </Button>
              )}
            </div>
          </div>
        ))}
        {request.documents.length === 0 && <p style={{ color: T.ink3, fontSize: 13, margin: 0 }}>Niciun atașament încă.</p>}
      </div>
    </Card>
  );
}

// Fluxul de lucru al cererii — motor pe stări+tranziții (nu mai e o listă liniară de
// pași). Afișăm istoricul evenimentelor deja aplicate (dintr-un WorkflowCaseEvent) și
// tranzițiile disponibile din starea curentă (sau tranzițiile de START dacă nu are încă
// un caz), inclusiv orice bifă manuală de confirmare (validare MANUAL_CHECKLIST) și
// câmpul de comentariu, dacă tranziția respectivă îl cere.
function WorkflowCard({ request, onChange }: { request: DmsRequestDetail; onChange: () => void }) {
  const [transitions, setTransitions] = useState<WorkflowTransitionDto[]>([]);
  const [activeCase, setActiveCase] = useState<WorkflowCaseDto | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const [transitionComment, setTransitionComment] = useState("");
  const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetchCaseTransitions(request.id)
      .then((res) => {
        setActiveCase(res.case);
        setTransitions(res.availableTransitions);
      })
      .catch(() => {
        setActiveCase(null);
        setTransitions([]);
      });
  }
  useEffect(load, [request.id]);

  const selected = transitions.find((t) => t.id === selectedTransitionId) || null;
  const checklistValidations = (selected?.validations || []).filter((v) => v.type === "MANUAL_CHECKLIST");

  async function handleApply() {
    if (!selected) return;
    if (selected.requiresComment && !transitionComment.trim()) {
      setError("Această tranziție necesită un comentariu");
      return;
    }
    const missingChecklist = checklistValidations.some((v) => !checklistChecked[v.id!]);
    if (missingChecklist) {
      setError("Bifează toate confirmările manuale înainte de a continua");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const checklistConfirmations = checklistValidations.filter((v) => checklistChecked[v.id!]).map((v) => v.id!);
      const payload = { transitionId: selected.id, comment: transitionComment || undefined, checklistConfirmations };
      if (activeCase) await advanceWorkflowCase(request.id, payload);
      else await initiateWorkflowCase(request.id, payload);
      setSelectedTransitionId(null);
      setTransitionComment("");
      setChecklistChecked({});
      load();
      onChange();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Tranziția nu a putut fi aplicată");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="request-detail-workflow-card" style={{ marginBottom: 20 }}>
      <SectionHeader title="Flux de lucru" />

      {activeCase ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: T.ink3, marginBottom: 8 }}>Stare curentă</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill color={activeCase.currentState.color} bg={T.line2} style={{ fontSize: 13 }}>{activeCase.currentState.name}</Pill>
            {activeCase.dueAt && (() => {
              const days = Math.ceil((new Date(activeCase.dueAt!).getTime() - Date.now()) / 86_400_000);
              const st = statusFor(days);
              return <Pill color={st.color} bg={st.bg}>Termen flux: {st.label}</Pill>;
            })()}
          </div>

          {!!activeCase.events?.length && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              {activeCase.events.map((ev) => (
                <div key={ev.id} style={{ fontSize: 12, color: T.ink3 }}>
                  {ev.fromState ? ev.fromState.name : "START"} → <strong style={{ color: T.ink2 }}>{ev.toState.name}</strong>
                  {ev.transition && <> · {ev.transition.name}</>}
                  {ev.performedBy && <> · {ev.performedBy.name || ev.performedBy.email}</>}
                  {!ev.performedBy && <> · automat (declanșator)</>}
                  <> · {new Date(ev.createdAt).toLocaleString("ro-RO")}</>
                  {ev.comment && <div style={{ color: T.ink2, marginTop: 2 }}>„{ev.comment}”</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: T.ink3, fontSize: 13 }}>Niciun flux inițiat pentru această cerere.</p>
      )}

      {transitions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: T.ink3, marginBottom: 8 }}>
            {activeCase ? "Tranziții disponibile din starea curentă" : "Fluxuri disponibile pentru inițiere"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {transitions.map((t) => (
              <Button
                key={t.id}
                variant={selectedTransitionId === t.id ? "primary" : "ghost"}
                style={{ fontSize: 12, padding: "8px 14px" }}
                onClick={() => setSelectedTransitionId(selectedTransitionId === t.id ? null : t.id)}
              >
                {t.name} {t.toState && `→ ${t.toState.name}`}
              </Button>
            ))}
          </div>

          {selected && (
            <div style={{ padding: 14, background: T.line2, borderRadius: 12 }}>
              {checklistValidations.map((v) => (
                <label key={v.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!checklistChecked[v.id!]}
                    onChange={(e) => setChecklistChecked({ ...checklistChecked, [v.id!]: e.target.checked })}
                  />
                  {(v.config as any)?.label || "Confirmare manuală"}
                </label>
              ))}
              {(
                <input
                  value={transitionComment}
                  onChange={(e) => setTransitionComment(e.target.value)}
                  placeholder={selected.requiresComment ? "Comentariu (obligatoriu)" : "Comentariu (opțional)"}
                  style={{ width: "100%", marginBottom: 10 }}
                />
              )}
              <Button onClick={handleApply} style={{ fontSize: 13 }}>
                {busy ? "Se aplică..." : `Aplică: ${selected.name}`}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: T.danger, fontSize: 12, marginTop: 10 }}>{error}</p>}
    </Card>
  );
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState<DmsRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [templates, setTemplates] = useState<ResponseTemplateDto[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [previewingResponseId, setPreviewingResponseId] = useState<string | null>(null);
  const [placingSignatureFor, setPlacingSignatureFor] = useState<string | null>(null);
  const [placementSaved, setPlacementSaved] = useState(false);

  function load() {
    if (!id) return;
    fetchRequestDetail(id).then(setRequest).catch((e) => setError(e?.response?.data?.error || "Eroare la încărcare"));
  }

  useEffect(load, [id]);
  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  if (!request) {
    return (
      <AppShell title="Cerere" subtitle="Se încarcă...">
        {error && <p style={{ color: T.danger }}>{error}</p>}
      </AppShell>
    );
  }

  async function handleAddComment() {
    if (!comment.trim()) return;
    await addComment(request!.id, comment);
    setComment("");
    load();
  }

  async function handleGenerateResponse() {
    if (!selectedTemplate) return;
    const created = await generateResponse(request!.id, selectedTemplate);
    setPreviewingResponseId(created.id);
    load();
  }

  return (
    <AppShell
      title={`Cerere ${request.registryNumber} · nr. ${request.numberKind === "INTERN" ? "intern" : "intrare"} din ${new Date(request.registeredAt).toLocaleDateString("ro-RO")}`}
      subtitle={`Depusă de ${request.submitterName} (${request.submitterEmail})`}
    >
      <div style={{ marginBottom: 14 }}>
        <Button variant="ghost" onClick={() => navigate("/registratura")}>← Înapoi la registratură</Button>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Date formular" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {Object.entries(request.data || {}).map(([key, value]) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11.5, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.3 }}>{key}</span>
              <span style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>{String(value)}</span>
            </div>
          ))}
        </div>
      </Card>

      <AttachmentsCard request={request} onChange={load} />

      <WorkflowCard request={request} onChange={load} />

      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Răspuns oficial" />
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} style={{ flex: 1 }}>
            <option value="">Alege un șablon...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <Button id="request-detail-response-generate-btn" onClick={handleGenerateResponse}>Generează</Button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {request.responses.map((r, rIdx) => {
            const isPreviewing = previewingResponseId === r.id;
            const isPlacing = placingSignatureFor === r.id;
            const existingPlacement = r.document?.signaturePlacements?.[0];
            return (
              <div key={r.id} style={{ padding: 14, background: T.line2, borderRadius: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: isPreviewing ? 12 : 0 }}>
                  <Button
                    variant="ghost"
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => setPreviewingResponseId(isPreviewing ? null : r.id)}
                  >
                    {isPreviewing ? "Ascunde previzualizarea" : "Previzualizare document"}
                  </Button>

                  {r.status === "DRAFT" && (
                    <>
                      <Button
                        variant="ghost"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        onClick={() => {
                          setPlacingSignatureFor(isPlacing ? null : r.id);
                          setPreviewingResponseId(r.id);
                          setPlacementSaved(false);
                        }}
                      >
                        {isPlacing ? "Anulează poziționarea" : "Poziționează semnătura"}
                      </Button>
                      <Button
                        id={rIdx === 0 ? "request-detail-sign-btn" : undefined}
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        onClick={async () => {
                          await signResponse(r.id);
                          setPlacingSignatureFor(null);
                          load();
                        }}
                      >
                        Semnează electronic
                      </Button>
                    </>
                  )}
                  {r.status === "SIGNED" && (
                    <>
                      <Pill color={T.success} bg={T.successTint}>Semnat · nr. ieșire {r.outboundNumber} din {r.signedAt && new Date(r.signedAt).toLocaleDateString("ro-RO")}</Pill>
                      <Button id={rIdx === 0 ? "request-detail-send-btn" : undefined} style={{ fontSize: 12, padding: "6px 12px" }} onClick={async () => { await sendResponse(r.id); load(); }}>Trimite petentului</Button>
                    </>
                  )}
                  {r.status === "SENT" && (
                    <Pill color={T.success} bg={T.successTint}>Trimis · nr. ieșire {r.outboundNumber} din {r.signedAt && new Date(r.signedAt).toLocaleDateString("ro-RO")}</Pill>
                  )}
                </div>

                {isPreviewing && r.document && (
                  <div style={{ marginTop: 12 }}>
                    <PdfPreview
                      documentId={r.document.id}
                      existingPlacement={existingPlacement}
                      placementMode={isPlacing}
                      onPlace={async (box) => {
                        await createSignaturePlacement(r.id, box);
                        setPlacementSaved(true);
                      }}
                    />
                    {isPlacing && placementSaved && (
                      <p style={{ fontSize: 12, color: T.success, marginTop: 8 }}>Poziție salvată — apasă „Semnează electronic” pentru a finaliza.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {request.responses.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun răspuns generat încă.</p>}
        </div>
      </Card>

      <Card id="request-detail-comments">
        <SectionHeader title="Comentarii" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {request.comments.map((c) => (
            <div key={c.id} style={{ fontSize: 13 }}>
              <strong>{c.author.name || c.author.email}</strong>
              <span style={{ color: T.ink3 }}> · {new Date(c.createdAt).toLocaleString("ro-RO")}</span>
              <div>{c.body}</div>
            </div>
          ))}
          {request.comments.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun comentariu încă.</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentariu nou (folosește @nume pentru mențiuni)"
            style={{ flex: 1 }}
          />
          <Button onClick={handleAddComment}>Trimite</Button>
        </div>
      </Card>

      {error && <p style={{ color: T.danger, marginTop: 14 }}>{error}</p>}
    </AppShell>
  );
}
