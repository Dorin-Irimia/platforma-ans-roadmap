import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Mic, Send, Paperclip, Volume2, FileText, Plus, Search, Trash2, Pencil, FileOutput, Smile, Frown, AlertCircle } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { PdfPreview } from "../components/PdfPreview";
import { T } from "../theme";
import { useAuth } from "../features/iam/AuthContext";
import {
  fetchConversations,
  createConversation,
  fetchConversation,
  renameConversation,
  deleteConversation,
  sendMessage,
  fetchAttachmentBlobUrl,
  fetchAvailableTemplates,
  generateDocument,
  previewDocument,
  fetchKnowledgeDocuments,
  uploadKnowledgeDocuments,
  deleteKnowledgeDocument,
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  fetchChatVariables,
  createChatVariable,
  deleteChatVariable,
  ChatVariableDto,
  fetchChatbotSettings,
  updateChatbotSettings,
  fetchConversationsNeedingReview,
  resolveConversationReview,
  ChatConversationSummary,
  ChatConversationDetail,
  ChatMessageDto,
  ChatTemplateAvailableDto,
  ChatKnowledgeDocumentDto,
  ChatTemplateDto,
  ConversationNeedingReviewDto,
  ChatSentiment,
} from "../features/chatbot/api";
import { isSpeechRecognitionSupported, startSpeechRecognition, isSpeechSynthesisSupported, speakText } from "../features/chatbot/speech";

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR", "EVALUATOR", "AUTOR", "CO_AUTOR"];

// Identificare stare emoțională (cerință 4.5.11) — indicator discret pe mesajele
// utilizatorului; NEUTRU nu se afișează (ar fi zgomot vizual pe majoritatea mesajelor).
const SENTIMENT_ICON: Record<Exclude<ChatSentiment, "NEUTRU">, JSX.Element> = {
  POZITIV: <Smile size={11} />,
  FRUSTRAT: <Frown size={11} />,
  NEGATIV: <AlertCircle size={11} />,
};

// ------------------------------------------------------------
// Firul de discuție
// ------------------------------------------------------------
function MessageBubble({ message, ttsId }: { message: ChatMessageDto; ttsId?: string }) {
  const isUser = message.role === "USER";
  const [preview, setPreview] = useState<{ filename: string; blobUrl: string } | null>(null);

  async function handleAttachmentClick(a: { id: string; filename: string; mimeType: string }) {
    const url = await fetchAttachmentBlobUrl(a.id);
    // Previzualizare inline doar pentru PDF (react-pdf nu randează alte formate) —
    // restul atașamentelor (imagini, docx etc.) se deschid direct într-un tab nou.
    if (a.mimeType === "application/pdf") {
      setPreview({ filename: a.filename, blobUrl: url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "72%",
          background: isUser ? T.brand : T.line2,
          color: isUser ? "#fff" : T.ink,
          borderRadius: 14,
          padding: "10px 14px",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
        {message.attachments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {message.attachments.map((a) => (
              <div
                key={a.id}
                onClick={() => handleAttachmentClick(a)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  padding: "5px 8px",
                  borderRadius: 8,
                  background: isUser ? "rgba(255,255,255,0.18)" : T.card,
                  color: isUser ? "#fff" : T.ink2,
                }}
              >
                <FileText size={13} /> {a.filename}
              </div>
            ))}
          </div>
        )}
        {preview && (
          <Modal onClose={() => setPreview(null)} width="auto" maxHeight="88vh">
            <Card style={{ maxHeight: "88vh", overflowY: "auto" }}>
              <SectionHeader title={preview.filename} />
              <PdfPreview fileUrl={preview.blobUrl} width={560} />
              <Button variant="ghost" style={{ marginTop: 14 }} onClick={() => setPreview(null)}>Închide</Button>
            </Card>
          </Modal>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          {message.inputMethod === "VOICE" && (
            <span style={{ fontSize: 10.5, opacity: 0.8, display: "flex", alignItems: "center", gap: 3 }}>
              <Mic size={10} /> mesaj vocal
            </span>
          )}
          {isUser && message.sentiment && message.sentiment !== "NEUTRU" && (
            <span title={`Stare emoțională detectată: ${message.sentiment}`} style={{ fontSize: 10.5, opacity: 0.85, display: "flex", alignItems: "center", gap: 3 }}>
              {SENTIMENT_ICON[message.sentiment]}
            </span>
          )}
          {!isUser && isSpeechSynthesisSupported() && (
            <button
              id={ttsId}
              onClick={() => speakText(message.content)}
              title="Ascultă răspunsul"
              style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3, padding: 0, display: "flex" }}
            >
              <Volume2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GenerateDocumentModal({ conversationId, onClose, onGenerated }: { conversationId: string; onClose: () => void; onGenerated: () => void }) {
  const [templates, setTemplates] = useState<ChatTemplateAvailableDto[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ title: string; renderedBody: string } | null>(null);
  const [variableLabels, setVariableLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAvailableTemplates().then(setTemplates).catch(() => setTemplates([]));
    fetchChatVariables()
      .then((vars) => setVariableLabels(Object.fromEntries(vars.map((v) => [v.key, v.label]))))
      .catch(() => setVariableLabels({}));
  }, []);

  const selected = templates.find((t) => t.id === templateId);

  async function handlePreview() {
    if (!selected) return;
    setError(null);
    setSaving(true);
    try {
      const result = await previewDocument(conversationId, selected.id, values);
      setPreview(result);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut previzualiza documentul");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmGenerate() {
    if (!selected) return;
    setError(null);
    setSaving(true);
    try {
      await generateDocument(conversationId, selected.id, values);
      onGenerated();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut genera documentul");
    } finally {
      setSaving(false);
    }
  }

  // Pas de previzualizare (pct. 9): textul randat se arată înainte de a genera
  // PDF-ul final și a-l atașa în conversație.
  if (preview) {
    return (
      <Modal onClose={onClose} width={560}>
          <Card>
            <SectionHeader title={`Previzualizare — ${preview.title}`} />
            <div
              style={{
                maxHeight: "50vh",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                fontFamily: "Georgia, serif",
                fontSize: 13.5,
                lineHeight: 1.6,
                background: T.line2,
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 14,
              }}
            >
              {preview.renderedBody}
            </div>
            {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setPreview(null)}>Modifică</Button>
              <Button onClick={handleConfirmGenerate} style={{ opacity: saving ? 0.6 : 1 }}>{saving ? "Se generează..." : "Confirmă și generează"}</Button>
            </div>
          </Card>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} width={460}>
        <Card>
          <SectionHeader title="Generează document din șablon" />
          <FieldLabel>Șablon</FieldLabel>
          <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setValues({}); }} style={{ width: "100%", marginBottom: 14 }}>
            <option value="">Alege un șablon...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {selected && (
            <>
              {selected.variables.map((v) => (
                <div key={v} style={{ marginBottom: 10 }}>
                  <FieldLabel>{variableLabels[v] || v}</FieldLabel>
                  <input value={values[v] || ""} onChange={(e) => setValues({ ...values, [v]: e.target.value })} style={{ width: "100%" }} />
                </div>
              ))}
              {selected.requiredAttachments.length > 0 && (
                <p id="chatbot-required-attachments-note" style={{ fontSize: 12, color: T.ink3 }}>
                  Documente suplimentare necesare: {selected.requiredAttachments.join(", ")} — atașează-le direct în conversație.
                </p>
              )}
            </>
          )}

          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Button variant="ghost" onClick={onClose}>Anulează</Button>
            <Button onClick={handlePreview} style={{ opacity: saving || !selected ? 0.6 : 1 }}>{saving ? "Se previzualizează..." : "Previzualizează"}</Button>
          </div>
        </Card>
    </Modal>
  );
}

function ConversationsTab({ isAdmin }: { isAdmin: boolean }) {
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<ChatConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  function loadList() {
    fetchConversations(search || undefined).then(setConversations).catch(() => setConversations([]));
  }
  useEffect(loadList, [search]);

  function loadActive(id: string) {
    fetchConversation(id).then(setActive).catch(() => setActive(null));
  }
  useEffect(() => {
    if (activeId) loadActive(activeId);
    else setActive(null);
  }, [activeId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    onDrop: (accepted) => setPendingFiles((prev) => [...prev, ...accepted]),
  });

  async function handleNewConversation() {
    const created = await createConversation();
    loadList();
    setActiveId(created.id);
  }

  async function handleSend() {
    if (!activeId || (!draft.trim() && pendingFiles.length === 0)) return;
    setSending(true);
    try {
      await sendMessage(activeId, { content: draft, inputMethod: "TEXT", files: pendingFiles });
      setDraft("");
      setPendingFiles([]);
      loadActive(activeId);
      loadList();
    } finally {
      setSending(false);
    }
  }

  function handleMic() {
    if (!isSpeechRecognitionSupported()) return;
    setRecording(true);
    startSpeechRecognition(
      async (transcript) => {
        if (!activeId) return;
        setSending(true);
        try {
          await sendMessage(activeId, { content: transcript, inputMethod: "VOICE" });
          loadActive(activeId);
          loadList();
        } finally {
          setSending(false);
        }
      },
      () => setRecording(false)
    );
  }

  async function handleDelete(id: string) {
    await deleteConversation(id);
    if (activeId === id) setActiveId(null);
    loadList();
  }

  async function handleRename(id: string) {
    if (renameValue.trim()) await renameConversation(id, renameValue.trim());
    setRenamingId(null);
    loadList();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, height: "calc(100vh - 260px)", minHeight: 480 }}>
      <Card style={{ display: "flex", flexDirection: "column", padding: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: T.line2, borderRadius: 10, padding: "6px 10px" }}>
            <Search size={13} color={T.ink3} />
            <input
              id="chatbot-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută..."
              style={{ border: "none", background: "none", outline: "none", fontSize: 13, width: "100%" }}
            />
          </div>
          <Button id="chatbot-new-conversation-btn" variant="ghost" style={{ padding: "6px 10px" }} onClick={handleNewConversation}>
            <Plus size={15} />
          </Button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveId(c.id)}
              style={{
                padding: "9px 10px",
                borderRadius: 10,
                cursor: "pointer",
                background: activeId === c.id ? T.brandTint : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
              {renamingId === c.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(c.id)}
                  onKeyDown={(e) => e.key === "Enter" && handleRename(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ flex: 1, fontSize: 13 }}
                />
              ) : (
                <span style={{ fontSize: 13, fontWeight: activeId === c.id ? 700 : 500, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.title}
                </span>
              )}
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.title); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.ink4, padding: 2 }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.ink4, padding: 2 }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {conversations.length === 0 && <p style={{ fontSize: 12.5, color: T.ink3, padding: 8 }}>Nicio conversație încă.</p>}
        </div>
      </Card>

      <Card style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        {!active ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.ink3, fontSize: 13 }}>
            Alege o conversație sau creează una nouă.
          </div>
        ) : (
          <>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{active.title}</span>
                {isAdmin && (
                  <span
                    style={{ fontSize: 11, color: T.ink3 }}
                    title="Răspunsurile pot include conținut din documentele deja arhivate, dacă sunt relevante pentru întrebare"
                  >
                    Fundamentat și pe Arhivă
                  </span>
                )}
              </div>
              <Button id="chatbot-generate-document-btn" variant="ghost" style={{ fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowGenerate(true)}>
                <FileOutput size={13} /> Generează document
              </Button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {active.messages.map((m, mIdx) => (
                <MessageBubble key={m.id} message={m} ttsId={m.role !== "USER" && mIdx === active.messages.findIndex((x) => x.role !== "USER") ? "chatbot-tts-btn" : undefined} />
              ))}
              {active.messages.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Scrie primul mesaj mai jos.</p>}
              <div ref={threadEndRef} />
            </div>
            <div {...getRootProps()} style={{ padding: 14, borderTop: `1px solid ${T.line}`, background: isDragActive ? T.brandTint : "transparent" }}>
              <input {...getInputProps()} />
              {pendingFiles.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {pendingFiles.map((f, i) => (
                    <Pill key={i} color={T.ink2} bg={T.line2}>{f.name}</Pill>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label id="chatbot-attach-btn" style={{ cursor: "pointer", color: T.ink3, display: "flex" }}>
                  <input type="file" multiple hidden onChange={(e) => setPendingFiles((prev) => [...prev, ...Array.from(e.target.files || [])])} />
                  <Paperclip size={18} />
                </label>
                {isSpeechRecognitionSupported() && (
                  <button
                    id="chatbot-mic-btn"
                    onClick={handleMic}
                    title="Mesaj vocal"
                    style={{ background: recording ? T.dangerTint : "none", border: "none", cursor: "pointer", color: recording ? T.danger : T.ink3, borderRadius: 8, padding: 6, display: "flex" }}
                  >
                    <Mic size={18} />
                  </button>
                )}
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Scrie un mesaj..."
                  style={{ flex: 1 }}
                />
                <Button onClick={handleSend} style={{ opacity: sending ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                  <Send size={14} /> Trimite
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {showGenerate && active && (
        <GenerateDocumentModal
          conversationId={active.id}
          onClose={() => setShowGenerate(false)}
          onGenerated={() => { setShowGenerate(false); loadActive(active.id); }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Admin — bază de cunoștințe
// ------------------------------------------------------------
function DocumentsTab() {
  const [docs, setDocs] = useState<ChatKnowledgeDocumentDto[]>([]);
  const [uploading, setUploading] = useState(false);

  function load() {
    fetchKnowledgeDocuments().then(setDocs).catch(() => setDocs([]));
  }
  useEffect(load, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (accepted) => {
      if (!accepted.length) return;
      setUploading(true);
      try {
        await uploadKnowledgeDocuments(accepted);
        load();
      } finally {
        setUploading(false);
      }
    },
  });

  return (
    <div>
      <SectionHeader title={`${docs.length} documente în baza de cunoștințe`} />
      <div
        id="chatbot-documents-dropzone"
        {...getRootProps()}
        style={{ border: `2px dashed ${isDragActive ? T.brand : T.line}`, borderRadius: 12, padding: 24, textAlign: "center", background: isDragActive ? T.brandTint : T.bgSoft, cursor: "pointer", marginBottom: 16 }}
      >
        <input {...getInputProps()} />
        <p style={{ margin: 0, fontSize: 13, color: T.ink3 }}>{uploading ? "Se încarcă..." : "Trage documente (PDF/DOCX/TXT) aici sau dă click pentru a le selecta"}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {docs.map((d) => (
          <Card key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{d.filename}</div>
              <div style={{ fontSize: 11.5, color: T.ink3 }}>
                {d.extractedText ? "Text extras — disponibil pentru AI" : "Fără text extras (imagine sau format nesuportat)"}
              </div>
            </div>
            <Button variant="danger" style={{ padding: "6px 12px", fontSize: 12 }} onClick={async () => { await deleteKnowledgeDocument(d.id); load(); }}>Șterge</Button>
          </Card>
        ))}
        {docs.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun document încărcat încă.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Admin — șabloane de documente
// ------------------------------------------------------------
function emptyTemplateDraft() {
  return { name: "", category: "", body: "", variableKeys: [] as string[], requiredAttachmentsInput: "" };
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<ChatTemplateDto[]>([]);
  const [editing, setEditing] = useState<(ReturnType<typeof emptyTemplateDraft> & { id?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variables, setVariables] = useState<ChatVariableDto[]>([]);
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarLabel, setNewVarLabel] = useState("");

  function load() {
    fetchTemplates().then(setTemplates).catch(() => setTemplates([]));
  }
  function loadVariables() {
    fetchChatVariables().then(setVariables).catch(() => setVariables([]));
  }
  useEffect(load, []);
  useEffect(loadVariables, []);

  function startEdit(t?: ChatTemplateDto) {
    setEditing(
      t
        ? { id: t.id, name: t.name, category: t.category, body: t.body, variableKeys: [...t.variables], requiredAttachmentsInput: t.requiredAttachments.join(", ") }
        : emptyTemplateDraft()
    );
  }

  function toggleVariable(key: string) {
    if (!editing) return;
    const has = editing.variableKeys.includes(key);
    setEditing({ ...editing, variableKeys: has ? editing.variableKeys.filter((k) => k !== key) : [...editing.variableKeys, key] });
  }

  async function handleCreateVariable() {
    if (!newVarKey.trim() || !newVarLabel.trim()) return;
    try {
      const created = await createChatVariable({ key: newVarKey, label: newVarLabel });
      setNewVarKey("");
      setNewVarLabel("");
      loadVariables();
      if (editing) setEditing({ ...editing, variableKeys: [...editing.variableKeys, created.key] });
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut crea variabila");
    }
  }

  async function handleSave() {
    if (!editing) return;
    setError(null);
    const input = {
      name: editing.name,
      category: editing.category,
      body: editing.body,
      variables: editing.variableKeys,
      requiredAttachments: editing.requiredAttachmentsInput.split(",").map((v) => v.trim()).filter(Boolean),
    };
    try {
      if (editing.id) await updateTemplate(editing.id, input);
      else await createTemplate(input);
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut salva șablonul");
    }
  }

  if (editing) {
    return (
      <div>
        <Button variant="ghost" style={{ marginBottom: 14 }} onClick={() => setEditing(null)}>← Înapoi la listă</Button>
        <Card>
          <SectionHeader title={editing.id ? "Editare șablon" : "Șablon nou"} />
          <FieldLabel>Nume</FieldLabel>
          <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={{ width: "100%", marginBottom: 12 }} />
          <FieldLabel>Categorie</FieldLabel>
          <input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} style={{ width: "100%", marginBottom: 12 }} placeholder="ex: adeverinta" />
          <FieldLabel>Conținut (folosește {"{{VARIABILA}}"} pentru variabile)</FieldLabel>
          <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} style={{ width: "100%", minHeight: 160, marginBottom: 12 }} placeholder={"Stimate {{NUME}},\n\nPrin prezenta..."} />

          <FieldLabel>Variabile</FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {variables.map((v) => (
              <label
                key={v.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: `1px solid ${editing.variableKeys.includes(v.key) ? T.brand : T.line}`,
                  background: editing.variableKeys.includes(v.key) ? T.brandTint : T.card,
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={editing.variableKeys.includes(v.key)} onChange={() => toggleVariable(v.key)} style={{ margin: 0 }} />
                {v.label} <span style={{ color: T.ink3 }}>({v.key})</span>
              </label>
            ))}
            {variables.length === 0 && <p style={{ color: T.ink3, fontSize: 12.5, margin: 0 }}>Nicio variabilă definită încă — adaugă una mai jos.</p>}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input value={newVarKey} onChange={(e) => setNewVarKey(e.target.value)} placeholder="cheie (ex: CNP)" style={{ flex: 1 }} />
            <input value={newVarLabel} onChange={(e) => setNewVarLabel(e.target.value)} placeholder="etichetă (ex: CNP)" style={{ flex: 1 }} />
            <Button variant="ghost" style={{ fontSize: 12 }} onClick={handleCreateVariable}>+ variabilă nouă</Button>
          </div>

          <FieldLabel>Documente suplimentare necesare (separate prin virgulă)</FieldLabel>
          <input value={editing.requiredAttachmentsInput} onChange={(e) => setEditing({ ...editing, requiredAttachmentsInput: e.target.value })} style={{ width: "100%", marginBottom: 14 }} placeholder="Copie CI" />
          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
          <Button onClick={handleSave}>Salvează șablonul</Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button id="chatbot-template-new-btn" onClick={() => startEdit()}>+ Șablon nou</Button>
      </div>
      <SectionHeader title={`${templates.length} șabloane`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {templates.map((t) => (
          <Card key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: T.ink3 }}>categorie: {t.category} · variabile: {t.variables.join(", ") || "—"}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => startEdit(t)}>Editează</Button>
              <Button variant="danger" style={{ padding: "8px 12px", fontSize: 12 }} onClick={async () => { await deleteTemplate(t.id); load(); }}>Șterge</Button>
            </div>
          </Card>
        ))}
        {templates.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun șablon creat încă.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Admin — registru de variabile (pct. 5) — reutilizabil între șabloane; un șablon doar
// referă cheile de aici prin `variables: string[]`, fără nicio schimbare la substituție.
function VariablesTab() {
  const [variables, setVariables] = useState<ChatVariableDto[]>([]);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchChatVariables().then(setVariables).catch(() => setVariables([]));
  }
  useEffect(load, []);

  async function handleCreate() {
    if (!key.trim() || !label.trim()) {
      setError("Completează cheia și eticheta");
      return;
    }
    setError(null);
    try {
      await createChatVariable({ key, label, description: description || undefined });
      setKey("");
      setLabel("");
      setDescription("");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut crea variabila");
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Variabilă nouă" />
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="cheie (ex: CNP)" style={{ flex: 1 }} />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="etichetă (ex: CNP)" style={{ flex: 1 }} />
        </div>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="descriere (opțional)" style={{ width: "100%", marginBottom: 12 }} />
        {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
        <Button id="chatbot-variable-create-btn" onClick={handleCreate}>Creează variabila</Button>
      </Card>

      <SectionHeader title={`${variables.length} variabile`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {variables.map((v) => (
          <Card key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{v.label} <span style={{ color: T.ink3, fontWeight: 400 }}>({v.key})</span></div>
              {v.description && <div style={{ fontSize: 12, color: T.ink3 }}>{v.description}</div>}
            </div>
            <Button
              variant="danger"
              style={{ padding: "8px 12px", fontSize: 12 }}
              onClick={async () => { await deleteChatVariable(v.id); load(); }}
            >
              Șterge
            </Button>
          </Card>
        ))}
        {variables.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Nicio variabilă creată încă.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Regulă automată: mesaje cu cuvinte-cheie configurate semnalează conversația pentru
// intervenție umană — aici se configurează cuvintele și se văd conversațiile semnalate.
function AutomationTab() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [flagged, setFlagged] = useState<ConversationNeedingReviewDto[]>([]);
  const [saving, setSaving] = useState(false);

  function load() {
    fetchChatbotSettings().then((s) => setKeywords(s.escalationKeywords)).catch(() => setKeywords([]));
    fetchConversationsNeedingReview().then(setFlagged).catch(() => setFlagged([]));
  }
  useEffect(load, []);

  async function saveKeywords(next: string[]) {
    setSaving(true);
    try {
      await updateChatbotSettings(next);
      setKeywords(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Cuvinte-cheie de escaladare" />
        <p style={{ fontSize: 12.5, color: T.ink3, marginTop: -6, marginBottom: 12 }}>
          Un mesaj care conține unul din aceste cuvinte semnalează automat conversația pentru intervenție umană.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {keywords.map((k) => (
            <Pill key={k} color={T.ink2} bg={T.line2}>
              {k}{" "}
              <span style={{ cursor: "pointer", marginLeft: 4 }} onClick={() => saveKeywords(keywords.filter((x) => x !== k))}>✕</span>
            </Pill>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="Cuvânt nou" style={{ flex: 1 }} />
          <Button
            disabled={saving || !newKeyword.trim()}
            onClick={() => {
              const k = newKeyword.trim();
              if (k) saveKeywords([...keywords, k]);
              setNewKeyword("");
            }}
          >
            Adaugă
          </Button>
        </div>
      </Card>

      <SectionHeader title={`${flagged.length} conversații necesită intervenție`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {flagged.map((c) => (
          <Card key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</div>
              <div style={{ fontSize: 12.5, color: T.ink3, marginTop: 2 }}>
                {c.user.name || c.user.email} · {c._count.messages} mesaje · {c.needsReviewReason}
              </div>
            </div>
            <Button variant="ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => resolveConversationReview(c.id).then(load)}>
              Marchează rezolvat
            </Button>
          </Card>
        ))}
        {flagged.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Nicio conversație semnalată.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
export default function ChatbotPage() {
  const { user } = useAuth();
  const isAdmin = user && STAFF_ROLES.includes(user.role);
  const [tab, setTab] = useState<"conversations" | "documents" | "templates" | "variables" | "automation">("conversations");

  const tabs = [
    { key: "conversations" as const, label: "Conversații" },
    ...(isAdmin
      ? [
          { key: "documents" as const, label: "Documente" },
          { key: "templates" as const, label: "Șabloane" },
          { key: "variables" as const, label: "Variabile" },
          { key: "automation" as const, label: "Automatizări" },
        ]
      : []),
  ];

  return (
    <AppShell title="Asistent Virtual AI" subtitle="Conversații, documente și șabloane pentru asistentul chatbot">
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${T.line}` }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            id={`chatbot-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{
              border: "none",
              background: "none",
              padding: "8px 4px",
              marginRight: 18,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              color: tab === t.key ? T.brand : T.ink3,
              borderBottom: tab === t.key ? `2px solid ${T.brand}` : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "conversations" && <ConversationsTab isAdmin={!!isAdmin} />}
      {tab === "documents" && isAdmin && <DocumentsTab />}
      {tab === "templates" && isAdmin && <TemplatesTab />}
      {tab === "variables" && isAdmin && <VariablesTab />}
      {tab === "automation" && isAdmin && <AutomationTab />}
    </AppShell>
  );
}
