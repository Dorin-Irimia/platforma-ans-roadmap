// Certificat de absolvire (cerință CNFPA 4.5.8) — emis automat la finalizarea unui curs,
// aceeași tehnică PDFKit ca dms/pdf.ts (fără Chromium, potrivit unui container mic).
import PDFDocument from "pdfkit";

export interface CertificatePdfInput {
  certificateNumber: string;
  studentName: string;
  courseTitle: string;
  issuedAt: string;
}

export function generateCertificatePdf(input: CertificatePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(24, 24, doc.page.width - 48, doc.page.height - 48).lineWidth(2).stroke("#e85a0c");

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#6A6F78")
      .text("AGENȚIA NAȚIONALĂ PENTRU SPORT · CNFPA", { align: "center" })
      .moveDown(1.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(26)
      .fillColor("#0E1116")
      .text("CERTIFICAT DE ABSOLVIRE", { align: "center" })
      .moveDown(1.2);

    doc
      .font("Helvetica")
      .fontSize(13)
      .fillColor("#3C4149")
      .text("Se certifică prin prezenta că", { align: "center" })
      .moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#e85a0c")
      .text(input.studentName, { align: "center" })
      .moveDown(0.5);

    doc
      .font("Helvetica")
      .fontSize(13)
      .fillColor("#3C4149")
      .text("a absolvit cu succes cursul", { align: "center" })
      .moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor("#0E1116")
      .text(input.courseTitle, { align: "center" })
      .moveDown(2);

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#6A6F78")
      .text(`Nr. certificat: ${input.certificateNumber}`, { align: "center" })
      .text(`Data emiterii: ${input.issuedAt}`, { align: "center" });

    doc.end();
  });
}
