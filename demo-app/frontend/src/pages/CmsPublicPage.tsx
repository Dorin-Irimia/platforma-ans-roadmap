import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { Languages } from "lucide-react";
import { Card, Button } from "../components/ui";
import { T, FONT } from "../theme";
import { fetchCmsPagePublic, CmsPageDto } from "../features/portal/api";

// Randare publică a unei pagini CMS (4.5.1 R59-62) — fără autentificare, ca la Portal/
// Muzeu/Anuarul Sportului. Selector RO/EN (R97) — vezi nota de scop din
// backend/src/modules/portal/README.md despre limitele acestui selector.
export default function CmsPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<CmsPageDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [lang, setLang] = useState<"ro" | "en">("ro");

  useEffect(() => {
    if (!slug) return;
    fetchCmsPagePublic(slug).then(setPage).catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.body, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card><p style={{ color: T.ink3 }}>Pagina căutată nu există sau nu este publicată.</p></Card>
      </div>
    );
  }
  if (!page) return null;

  const hasEnglish = !!(page.titleEn || page.bodyHtmlEn);
  const title = lang === "en" && page.titleEn ? page.titleEn : page.title;
  const bodyHtml = lang === "en" && page.bodyHtmlEn ? page.bodyHtmlEn : page.bodyHtml;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.body }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <Link to="/portal" style={{ fontSize: 13, fontWeight: 700 }}>← Înapoi la Portal</Link>
          {hasEnglish && (
            <Button
              id="cms-lang-toggle-btn"
              variant="ghost"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
              onClick={() => setLang((l) => (l === "ro" ? "en" : "ro"))}
            >
              <Languages size={14} /> {lang === "ro" ? "English" : "Română"}
            </Button>
          )}
        </div>
        <Card>
          <h1 style={{ marginTop: 0 }}>{title}</h1>
          <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyHtml) }} />
        </Card>
      </div>
    </div>
  );
}
