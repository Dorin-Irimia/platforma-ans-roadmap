import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Plus, Eye, Trash2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { T } from "../theme";
import {
  fetchCmsPages,
  createCmsPage,
  updateCmsPage,
  deleteCmsPage,
  seedMandatoryCmsPages,
  fetchEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate,
  CmsPageDto,
  EmailTemplateDto,
} from "../features/portal/api";

// Editor de rich-text compact (TipTap) — subset din bara de instrumente folosită în
// LMS (components/lms/BlockEditor.tsx), fără tabele/AI-rewrite, suficient pentru
// paginile publice CMS (Termeni/Confidențialitate/Contact/bannere).
function MiniRichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  if (!editor) return null;
  return (
    <div className="tiptap-editor-shell rich-text-content">
      <div style={{ display: "flex", gap: 4, padding: "2px 2px 8px", borderBottom: `1px solid ${T.line}`, marginBottom: 8 }}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={{ background: editor.isActive("bold") ? T.brand : "transparent", color: editor.isActive("bold") ? "#fff" : T.ink2, border: "none", borderRadius: 6, width: 26, height: 26 }}><Bold size={13} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={{ background: editor.isActive("italic") ? T.brand : "transparent", color: editor.isActive("italic") ? "#fff" : T.ink2, border: "none", borderRadius: 6, width: 26, height: 26 }}><Italic size={13} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} style={{ background: editor.isActive("underline") ? T.brand : "transparent", color: editor.isActive("underline") ? "#fff" : T.ink2, border: "none", borderRadius: 6, width: 26, height: 26 }}><UnderlineIcon size={13} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={{ background: editor.isActive("bulletList") ? T.brand : "transparent", color: editor.isActive("bulletList") ? "#fff" : T.ink2, border: "none", borderRadius: 6, width: 26, height: 26 }}><List size={13} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={{ background: editor.isActive("orderedList") ? T.brand : "transparent", color: editor.isActive("orderedList") ? "#fff" : T.ink2, border: "none", borderRadius: 6, width: 26, height: 26 }}><ListOrdered size={13} /></button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function PagesTab() {
  const [pages, setPages] = useState<CmsPageDto[]>([]);
  const [editing, setEditing] = useState<CmsPageDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ slug: "", title: "", bodyHtml: "", titleEn: "", bodyHtmlEn: "" });

  function load() {
    fetchCmsPages().then(setPages).catch(() => setPages([]));
  }
  useEffect(load, []);

  async function handleCreate() {
    await createCmsPage(draft);
    setCreating(false);
    setDraft({ slug: "", title: "", bodyHtml: "", titleEn: "", bodyHtmlEn: "" });
    load();
  }

  async function handleTogglePublish(p: CmsPageDto) {
    await updateCmsPage(p.id, { isPublished: !p.isPublished });
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Button id="cms-new-page-btn" onClick={() => setCreating((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Pagină nouă</Button>
        <Button variant="ghost" onClick={() => seedMandatoryCmsPages().then(load)}>Creează paginile obligatorii (Termeni/Confidențialitate/Contact)</Button>
      </div>

      {creating && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>Slug (URL)</FieldLabel><input id="cms-page-slug-input" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="ex: despre-noi" style={{ width: "100%" }} /></div>
            <div><FieldLabel>Titlu (RO)</FieldLabel><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ width: "100%" }} /></div>
          </div>
          <FieldLabel>Conținut (RO)</FieldLabel>
          <div style={{ marginBottom: 12 }}><MiniRichTextEditor value={draft.bodyHtml} onChange={(html) => setDraft({ ...draft, bodyHtml: html })} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>Titlu (EN, opțional)</FieldLabel><input value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} style={{ width: "100%" }} /></div>
            <div><FieldLabel>Conținut (EN, opțional — text simplu)</FieldLabel><input value={draft.bodyHtmlEn} onChange={(e) => setDraft({ ...draft, bodyHtmlEn: e.target.value })} style={{ width: "100%" }} /></div>
          </div>
          <Button id="cms-page-save-btn" onClick={handleCreate}>Salvează pagina</Button>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pages.map((p) => (
          <Card key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: T.ink3 }}>/pagini/{p.slug}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Pill color={p.isPublished ? T.success : T.ink3} bg={p.isPublished ? T.successTint : T.line2}>{p.isPublished ? "Publicată" : "Ciornă"}</Pill>
                <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => handleTogglePublish(p)}>{p.isPublished ? "Retrage" : "Publică"}</Button>
                <a href={`/pagini/${p.slug}`} target="_blank" rel="noreferrer"><Button variant="ghost" style={{ padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Eye size={13} /> Vezi</Button></a>
                <button onClick={() => deleteCmsPage(p.id).then(load)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink4 }}><Trash2 size={14} /></button>
              </div>
            </div>
          </Card>
        ))}
        {pages.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Nicio pagină creată încă.</p>}
      </div>
    </div>
  );
}

function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplateDto[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ key: "", subject: "", bodyHtml: "", variablesText: "" });
  const [preview, setPreview] = useState<{ subject: string; bodyHtml: string } | null>(null);

  function load() {
    fetchEmailTemplates().then(setTemplates).catch(() => setTemplates([]));
  }
  useEffect(load, []);

  async function handleCreate() {
    const variables = draft.variablesText.split(",").map((v) => v.trim()).filter(Boolean);
    await createEmailTemplate({ key: draft.key, subject: draft.subject, bodyHtml: draft.bodyHtml, variables });
    setCreating(false);
    setDraft({ key: "", subject: "", bodyHtml: "", variablesText: "" });
    load();
  }

  async function handlePreview(t: EmailTemplateDto) {
    const mockValues: Record<string, string> = {};
    t.variables.forEach((v) => (mockValues[v] = `[exemplu ${v}]`));
    const result = await previewEmailTemplate(t.id, mockValues);
    setPreview(result);
  }

  return (
    <div>
      <Button onClick={() => setCreating((v) => !v)} style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Șablon nou</Button>

      {creating && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>Cheie (identificator)</FieldLabel><input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="ex: cerere-primita" style={{ width: "100%" }} /></div>
            <div><FieldLabel>Subiect</FieldLabel><input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Cererea ta {{NR_INREGISTRARE}} a fost înregistrată" style={{ width: "100%" }} /></div>
          </div>
          <FieldLabel>Conținut (cu {"{{VARIABILE}}"})</FieldLabel>
          <textarea value={draft.bodyHtml} onChange={(e) => setDraft({ ...draft, bodyHtml: e.target.value })} style={{ width: "100%", minHeight: 100, marginBottom: 12 }} />
          <FieldLabel>Variabile (separate prin virgulă)</FieldLabel>
          <input value={draft.variablesText} onChange={(e) => setDraft({ ...draft, variablesText: e.target.value })} placeholder="NR_INREGISTRARE, NUME" style={{ width: "100%", marginBottom: 12 }} />
          <Button onClick={handleCreate}>Salvează șablonul</Button>
        </Card>
      )}

      {preview && (
        <Card style={{ marginBottom: 16, background: T.brandTint }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{preview.subject}</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{preview.bodyHtml}</div>
          <Button variant="ghost" style={{ marginTop: 10 }} onClick={() => setPreview(null)}>Închide previzualizarea</Button>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {templates.map((t) => (
          <Card key={t.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{t.key}</div>
                <div style={{ fontSize: 12, color: T.ink3 }}>{t.subject}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => handlePreview(t)}>Previzualizează</Button>
                <button onClick={() => deleteEmailTemplate(t.id).then(load)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink4 }}><Trash2 size={14} /></button>
              </div>
            </div>
          </Card>
        ))}
        {templates.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun șablon creat încă.</p>}
      </div>
    </div>
  );
}

export default function CmsAdminPage() {
  const [tab, setTab] = useState<"pagini" | "email">("pagini");
  return (
    <AppShell title="Pagini publice" subtitle="CMS pentru pagini publice (Termeni/Confidențialitate/Contact) și șabloane de email">
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${T.line}` }}>
        {[{ key: "pagini" as const, label: "Pagini" }, { key: "email" as const, label: "Șabloane email" }].map((t) => (
          <button
            key={t.key}
            id={`cms-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{ border: "none", background: "none", padding: "8px 4px", marginRight: 18, fontSize: 13, fontWeight: 700, cursor: "pointer", color: tab === t.key ? T.brand : T.ink3, borderBottom: tab === t.key ? `2px solid ${T.brand}` : "2px solid transparent" }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "pagini" && <PagesTab />}
      {tab === "email" && <EmailTemplatesTab />}
    </AppShell>
  );
}
