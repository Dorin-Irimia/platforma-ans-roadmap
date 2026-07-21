// Fundamentare pe Arhivă (extensie a fundamentării deja existente pe Registru — vezi
// registryContext.ts). Fără embeddings/vector DB (decizie explicită de scope pentru
// această rundă) — euristică naivă: suprapunere de cuvinte-cheie din mesajul utilizatorului
// cu numele fișierului/dosarului sau textul extras, doar pe documente deja ARHIVATE
// (archiveFolderId != null — nu documente aflate încă în flux de intrare/procesare, care
// n-au fost încă validate/clasificate ca aparținând unui dosar). Spre deosebire de
// ChatKnowledgeDocument (corpus mic, curat de admin, sigur de injectat mereu ca "top N
// recente"), Arhiva poate fi mare și conține date instituționale sensibile — de aceea NU
// injectăm niciodată "cele mai recente N" fără potrivire de cuvinte-cheie; fără potrivire,
// nu se adaugă niciun context de Arhivă (mai bine fără context decât context irelevant/scurs).
import { prisma } from "../../shared/prisma";

const MAX_ARCHIVE_DOCS = 5;
const MIN_KEYWORD_LEN = 4;
const MAX_KEYWORDS = 8;
// Aceeași valoare ca MAX_DOC_EXCERPT din conversations.routes.ts — redeclarată local (nu
// importată) ca să evităm o dependență circulară între cele două module.
const MAX_DOC_EXCERPT = 1500;

function extractKeywords(message: string): string[] {
  const tokens = message
    .toLowerCase()
    .split(/[^a-zăâîșț0-9]+/i)
    .filter((t) => t.length >= MIN_KEYWORD_LEN);
  return Array.from(new Set(tokens)).slice(0, MAX_KEYWORDS);
}

export async function buildArchiveContext(userMessage: string): Promise<string | undefined> {
  const keywords = extractKeywords(userMessage);
  if (keywords.length === 0) return undefined;

  const documents = await prisma.document.findMany({
    where: {
      archiveFolderId: { not: null },
      OR: keywords.flatMap((kw) => [
        { filename: { contains: kw, mode: "insensitive" as const } },
        { extractedText: { contains: kw, mode: "insensitive" as const } },
        { archiveFolder: { name: { contains: kw, mode: "insensitive" as const } } },
      ]),
    },
    select: { id: true, filename: true, extractedText: true, archiveFolder: { select: { name: true } } },
    take: MAX_ARCHIVE_DOCS,
    orderBy: { createdAt: "desc" },
  });

  const withText = documents.filter((d) => d.extractedText);
  if (withText.length === 0) return undefined;

  return withText
    .map((d) => `[Arhivă — dosar „${d.archiveFolder?.name}”] ${d.filename}:\n${(d.extractedText || "").slice(0, MAX_DOC_EXCERPT)}`)
    .join("\n\n");
}
