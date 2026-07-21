// Extragere de text din fișiere încărcate (documente cunoștințe + atașamente
// conversație + documente DMS/Arhivă) — PDF/DOCX/TXT au extragere reală; imaginile
// rămân fără text extras (fără OCR/vision în acest demo, scope cut asumat explicit).
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function extractText(mimeType: string, buffer: Buffer): Promise<string | undefined> {
  try {
    if (mimeType === "application/pdf") {
      const data = await pdfParse(buffer);
      return data.text.trim() || undefined;
    }
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim() || undefined;
    }
    if (mimeType.startsWith("text/")) {
      return buffer.toString("utf8").trim() || undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
