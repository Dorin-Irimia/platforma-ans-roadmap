import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../ui";
import { T } from "../../theme";
import {
  fetchIntents,
  createIntent,
  updateIntent,
  deleteIntent,
  fetchAssistantSettings,
  updateAssistantSettings,
  testAssistant,
  fetchAiSettings,
  updateAiSettings,
  fetchAssistantResources,
  uploadAssistantResources,
  deleteAssistantResource,
  LmsIntentDto,
  LmsAssistantResourceDto,
} from "../../features/lms/api";

function emptyIntentDraft() {
  return { name: "", triggerPhrasesInput: "", responseMode: "CANNED" as "CANNED" | "AI", cannedResponse: "" };
}

const MODEL_OPTIONS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];

// Motor AI (pct. 8) — reutilizează `/api/iam/ai-settings`, deja existent pe backend
// fără consumator în frontend până acum.
function AiEngineCard() {
  const [defaultModel, setDefaultModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchAiSettings().then((s) => setDefaultModel(s.defaultModel)).catch(() => {});
  }, []);

  const isCustom = !!defaultModel && !MODEL_OPTIONS.includes(defaultModel);

  async function handleSave(model: string) {
    setSaving(true);
    setMessage(null);
    try {
      const result = await updateAiSettings(model);
      setDefaultModel(result.defaultModel);
      setMessage("Salvat.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionHeader title="Motor AI" />
      <FieldLabel>Model de limbaj implicit</FieldLabel>
      <select
        id="lms-ai-model-select"
        value={isCustom ? "custom" : defaultModel}
        onChange={(e) => (e.target.value === "custom" ? setCustomModel(defaultModel) : handleSave(e.target.value))}
        style={{ width: "100%", marginBottom: 10 }}
      >
        {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
        <option value="custom">Altul...</option>
      </select>
      {(isCustom || customModel) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={customModel || defaultModel} onChange={(e) => setCustomModel(e.target.value)} style={{ flex: 1 }} placeholder="nume model" />
          <Button onClick={() => handleSave(customModel || defaultModel)} style={{ opacity: saving ? 0.6 : 1 }}>Salvează</Button>
        </div>
      )}
      {message && <p style={{ fontSize: 12, color: T.success, margin: 0 }}>{message}</p>}
      <p style={{ fontSize: 12, color: T.ink3, marginTop: 10, marginBottom: 0 }}>
        Cheia API se configurează separat, prin{" "}
        <a href="/secrets" style={{ color: T.brand }}>Secret Manager</a>.
      </p>
    </Card>
  );
}

// Materiale pentru adaptarea asistentului (pct. 3) — textul extras chiar fundamentează
// răspunsurile asistentului (vezi backend/assistant.routes.ts, buildResourceContext),
// nu antrenează un model separat — nu există infrastructură ML pentru asta în acest mediu.
function AssistantResourcesCard() {
  const [resources, setResources] = useState<LmsAssistantResourceDto[]>([]);
  const [uploading, setUploading] = useState(false);

  function load() {
    fetchAssistantResources().then(setResources).catch(() => setResources([]));
  }
  useEffect(load, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (accepted) => {
      if (!accepted.length) return;
      setUploading(true);
      try {
        await uploadAssistantResources(accepted);
        load();
      } finally {
        setUploading(false);
      }
    },
  });

  return (
    <Card>
      <SectionHeader title="Materiale pentru adaptarea modelului" />
      <p style={{ fontSize: 12, color: T.ink3, marginTop: -8, marginBottom: 12 }}>
        Textul din aceste materiale e folosit ca sursă de context pentru asistent — nu antrenează un model separat.
      </p>
      <div
        id="lms-assistant-resources-dropzone"
        {...getRootProps()}
        style={{ border: `2px dashed ${isDragActive ? T.brand : T.line}`, borderRadius: 12, padding: 24, textAlign: "center", background: isDragActive ? T.brandTint : T.bgSoft, cursor: "pointer", marginBottom: 16 }}
      >
        <input {...getInputProps()} />
        <UploadCloud size={22} color={T.ink3} style={{ display: "block", margin: "0 auto 6px" }} />
        <p style={{ margin: 0, fontSize: 13, color: T.ink3 }}>{uploading ? "Se încarcă..." : "Trage documente (PDF/DOCX/TXT) aici sau dă click pentru a le selecta"}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {resources.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.line2, borderRadius: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{r.filename}</span>
            <Button variant="danger" style={{ padding: "5px 10px", fontSize: 12 }} onClick={async () => { await deleteAssistantResource(r.id); load(); }}>Șterge</Button>
          </div>
        ))}
        {resources.length === 0 && <p style={{ color: T.ink3, fontSize: 13, margin: 0 }}>Niciun material încărcat încă.</p>}
      </div>
    </Card>
  );
}

// Configurare asistent — intenții personalizabile (pct. 4), setări de bază + glosar +
// pași de fallback (pct. 2, 3, 5), panou de test/optimizare (pct. 6).
export function AssistantPanel({ courseId }: { courseId: string }) {
  const [intents, setIntents] = useState<LmsIntentDto[]>([]);
  const [editing, setEditing] = useState<ReturnType<typeof emptyIntentDraft> & { id?: string } | null>(null);
  const [language, setLanguage] = useState("ro");
  const [tone, setTone] = useState("prietenos");
  const [domainTermsInput, setDomainTermsInput] = useState("");
  const [fallbackStepsInput, setFallbackStepsInput] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<{ matchedIntent: string | null; response: string } | null>(null);
  const [testing, setTesting] = useState(false);

  function loadIntents() {
    fetchIntents(courseId).then(setIntents).catch(() => setIntents([]));
  }
  useEffect(loadIntents, [courseId]);

  useEffect(() => {
    fetchAssistantSettings().then((s) => {
      setLanguage(s.language);
      setTone(s.tone);
      setDomainTermsInput(s.domainTerms.join(", "));
      setFallbackStepsInput(s.fallbackSteps.map((f) => f.prompt).join("\n"));
    });
  }, []);

  async function handleSaveSettings() {
    await updateAssistantSettings({
      language,
      tone,
      domainTerms: domainTermsInput.split(",").map((t) => t.trim()).filter(Boolean),
      fallbackSteps: fallbackStepsInput.split("\n").map((prompt, order) => ({ order, prompt: prompt.trim() })).filter((s) => s.prompt),
    });
  }

  async function handleSaveIntent() {
    if (!editing) return;
    const input = {
      name: editing.name,
      triggerPhrases: editing.triggerPhrasesInput.split(",").map((p) => p.trim()).filter(Boolean),
      responseMode: editing.responseMode,
      cannedResponse: editing.cannedResponse || undefined,
    };
    if (editing.id) await updateIntent(editing.id, input);
    else await createIntent(courseId, input);
    setEditing(null);
    loadIntents();
  }

  async function handleTest() {
    if (!testMessage.trim()) return;
    setTesting(true);
    try {
      const result = await testAssistant(courseId, testMessage);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <SectionHeader title="Setări de bază asistent" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
          <div>
            <FieldLabel>Limbă</FieldLabel>
            <input value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div>
            <FieldLabel>Ton</FieldLabel>
            <input value={tone} onChange={(e) => setTone(e.target.value)} style={{ width: "100%" }} placeholder="prietenos, formal, ..." />
          </div>
        </div>
        <FieldLabel>Glosar terminologie domeniu (separat prin virgulă)</FieldLabel>
        <input id="lms-assistant-glossary-input" value={domainTermsInput} onChange={(e) => setDomainTermsInput(e.target.value)} style={{ width: "100%", marginBottom: 12 }} />
        <FieldLabel>Pași flux conversațional / fallback (câte unul pe linie)</FieldLabel>
        <textarea id="lms-assistant-fallback-input" value={fallbackStepsInput} onChange={(e) => setFallbackStepsInput(e.target.value)} style={{ width: "100%", minHeight: 80, marginBottom: 12 }} />
        <Button id="lms-assistant-save-settings-btn" onClick={handleSaveSettings}>Salvează setările</Button>
      </Card>

      <Card>
        <SectionHeader title="Intenții personalizate" />
        {editing ? (
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Nume intenție</FieldLabel>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={{ width: "100%", marginBottom: 10 }} placeholder="ex: resetare parolă" />
            <FieldLabel>Fraze declanșator (separate prin virgulă)</FieldLabel>
            <input value={editing.triggerPhrasesInput} onChange={(e) => setEditing({ ...editing, triggerPhrasesInput: e.target.value })} style={{ width: "100%", marginBottom: 10 }} placeholder="resetare parolă, uitat parola" />
            <FieldLabel>Mod răspuns</FieldLabel>
            <select value={editing.responseMode} onChange={(e) => setEditing({ ...editing, responseMode: e.target.value as "CANNED" | "AI" })} style={{ width: "100%", marginBottom: 10 }}>
              <option value="CANNED">Răspuns fix</option>
              <option value="AI">Generat de AI</option>
            </select>
            {editing.responseMode === "CANNED" && (
              <>
                <FieldLabel>Răspuns fix</FieldLabel>
                <textarea value={editing.cannedResponse} onChange={(e) => setEditing({ ...editing, cannedResponse: e.target.value })} style={{ width: "100%", minHeight: 70, marginBottom: 10 }} />
              </>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" onClick={() => setEditing(null)}>Anulează</Button>
              <Button onClick={handleSaveIntent}>Salvează intenția</Button>
            </div>
          </div>
        ) : (
          <Button id="lms-assistant-new-intent-btn" variant="ghost" style={{ marginBottom: 14 }} onClick={() => setEditing(emptyIntentDraft())}>+ Intenție nouă</Button>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {intents.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, background: T.line2, borderRadius: 10 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{i.name}</span>
                <Pill style={{ marginLeft: 8 }}>{i.responseMode === "CANNED" ? "Fix" : "AI"}</Pill>
                <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>{i.triggerPhrases.join(", ")}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Button
                  variant="ghost"
                  style={{ fontSize: 11.5, padding: "5px 10px" }}
                  onClick={() => setEditing({ id: i.id, name: i.name, triggerPhrasesInput: i.triggerPhrases.join(", "), responseMode: i.responseMode, cannedResponse: i.cannedResponse || "" })}
                >
                  Editează
                </Button>
                <Button variant="danger" style={{ fontSize: 11.5, padding: "5px 10px" }} onClick={async () => { await deleteIntent(i.id); loadIntents(); }}>Șterge</Button>
              </div>
            </div>
          ))}
          {intents.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Nicio intenție creată încă.</p>}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Testare / optimizare interacțiuni" />
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="Scrie un mesaj de test..." style={{ flex: 1 }} />
          <Button id="lms-assistant-test-btn" onClick={handleTest} style={{ opacity: testing ? 0.6 : 1 }}>{testing ? "Se testează..." : "Testează"}</Button>
        </div>
        {testResult && (
          <div style={{ padding: 12, background: T.line2, borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: T.ink3, marginBottom: 6 }}>
              Intenție potrivită: {testResult.matchedIntent ? <Pill color={T.brand} bg={T.brandTint}>{testResult.matchedIntent}</Pill> : <Pill>Niciuna — fallback AI</Pill>}
            </div>
            <div style={{ fontSize: 13.5, color: T.ink }}>{testResult.response}</div>
          </div>
        )}
      </Card>

      <AiEngineCard />
      <AssistantResourcesCard />
    </div>
  );
}
