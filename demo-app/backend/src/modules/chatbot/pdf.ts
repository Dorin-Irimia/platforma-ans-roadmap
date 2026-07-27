// Generare PDF real pentru documentele produse prin conversație — același tipar
// (PDFKit, fără Chromium) ca la răspunsul oficial din DMS (vezi dms/pdf.ts).
import PDFDocument from "pdfkit";
import { registerPdfFonts, PDF_FONT, PDF_FONT_BOLD } from "../../shared/pdfFonts";

export function generateChatDocumentPdf(input: { title: string; body: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    registerPdfFonts(doc);

    doc.font(PDF_FONT_BOLD).fontSize(15).text(input.title).moveDown(1);
    doc.font(PDF_FONT).fontSize(11).text(input.body, { align: "justify", lineGap: 4 });

    doc.end();
  });
}
