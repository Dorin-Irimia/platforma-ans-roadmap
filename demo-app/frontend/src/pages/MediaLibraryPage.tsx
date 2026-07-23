import { useEffect, useState } from "react";
import { Upload, FileText, Trash2, Image as ImageIcon } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, SectionHeader } from "../components/ui";
import { T } from "../theme";
import { fetchMediaLibrary, uploadMediaAsset, deleteMediaAsset, openMediaAsset, MediaAssetDto } from "../features/portal/api";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Bibliotecă media generală (4.5.1 R98) — imagini/documente reutilizabile în conținut
// public (ex. bannere pe paginile CMS), distinctă de SPV-ul personal din /contul-meu.
export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAssetDto[]>([]);
  const [uploading, setUploading] = useState(false);

  function load() {
    fetchMediaLibrary().then(setAssets).catch(() => setAssets([]));
  }
  useEffect(load, []);

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      await uploadMediaAsset(file, false);
      load();
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell title="Bibliotecă media" subtitle="Imagini și documente reutilizabile pentru conținutul public (bannere, pagini CMS)">
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <SectionHeader title={`${assets.length} fișiere`} />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Button style={{ display: "flex", alignItems: "center", gap: 6, opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? "none" : "auto" }}>
              <Upload size={14} /> {uploading ? "Se încarcă..." : "Adaugă fișier"}
            </Button>
            <input type="file" style={{ display: "none" }} onChange={(e) => handleUpload(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {assets.map((a) => (
            <div key={a.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 70, background: T.line2, borderRadius: 8, marginBottom: 8 }}>
                {a.mimeType.startsWith("image/") ? <ImageIcon size={22} color={T.ink4} /> : <FileText size={22} color={T.ink4} />}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2, wordBreak: "break-word" }}>{a.filename}</div>
              <div style={{ fontSize: 11, color: T.ink3, marginBottom: 8 }}>{formatSize(a.sizeBytes)}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" style={{ fontSize: 11, padding: "4px 8px", flex: 1 }} onClick={() => openMediaAsset(a)}>Deschide</Button>
                <button onClick={() => deleteMediaAsset(a.id).then(load)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {assets.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun fișier în bibliotecă încă.</p>}
        </div>
      </Card>
    </AppShell>
  );
}
