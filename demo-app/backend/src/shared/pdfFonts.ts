// Fonturile standard PDFKit ("Helvetica"/"Helvetica-Bold") folosesc doar encoding
// WinAnsi — orice diacritic românesc din afara acestuia (ă/â/î/ș/ț) randează ca text
// corupt (ex. "Se certifică" → "Se certific2"). DejaVu Sans (font-dejavu, instalat în
// Dockerfile) acoperă Unicode Latin Extended-A — o înregistrăm o singură dată per
// document și o folosim în loc de Helvetica peste tot unde apare text în română.
import PDFDocument from "pdfkit";

export const PDF_FONT = "Body";
export const PDF_FONT_BOLD = "Body-Bold";

// Exportate și ca fișiere brute — folosite direct de dms/signature.ts (pdf-lib, nu
// PDFKit, are o API diferită de încărcare a fonturilor custom, via @pdf-lib/fontkit).
export const DEJAVU_REGULAR_PATH = "/usr/share/fonts/dejavu/DejaVuSans.ttf";
export const DEJAVU_BOLD_PATH = "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf";
export const DEJAVU_OBLIQUE_PATH = "/usr/share/fonts/dejavu/DejaVuSans-Oblique.ttf";

export function registerPdfFonts(doc: PDFKit.PDFDocument): void {
  doc.registerFont(PDF_FONT, DEJAVU_REGULAR_PATH);
  doc.registerFont(PDF_FONT_BOLD, DEJAVU_BOLD_PATH);
}
