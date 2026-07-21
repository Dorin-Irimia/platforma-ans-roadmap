// Generare PDF real pentru răspunsul oficial (nu doar text simplu) — folosim
// PDFKit pentru că desenează direct pe un "canvas" de PDF, fără Chromium/HTML,
// ceea ce îl face potrivit pentru un container Alpine mic (vezi research în
// backend/src/modules/dms/README.md). Semnătura efectivă se aplică ulterior
// peste acest PDF cu pdf-lib (vezi signature.ts), la momentul semnării.
import PDFDocument from "pdfkit";

export interface ResponsePdfInput {
  institutionName: string;
  registryNumber: string;
  date: string;
  submitterName: string;
  submitterEmail: string;
  body: string;
}

export function generateResponsePdf(input: ResponsePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(input.institutionName, { align: "center" })
      .moveDown(0.3)
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6A6F78")
      .text("Document generat automat din platforma digitală integrată", { align: "center" })
      .fillColor("#000")
      .moveDown(1.5);

    doc
      .fontSize(10)
      .text(`Nr. înregistrare: ${input.registryNumber}`, { continued: false })
      .text(`Data: ${input.date}`)
      .moveDown(0.5)
      .text(`Către: ${input.submitterName} (${input.submitterEmail})`)
      .moveDown(1.5);

    doc.fontSize(11).text(input.body, { align: "justify", lineGap: 4 });

    doc.moveDown(3);
    doc
      .fontSize(10)
      .fillColor("#6A6F78")
      .text("Semnătură electronică:", { continued: false })
      .rect(doc.x, doc.y + 6, 200, 60)
      .dash(3, { space: 2 })
      .stroke("#A0A5AD")
      .undash();

    doc.end();
  });
}

export interface FormPdfField {
  label: string;
  required: boolean;
  helpText?: string | null;
}

export interface FormPdfSection {
  name: string;
  fields: FormPdfField[];
}

export interface FormPdfInput {
  institutionName: string;
  title: string;
  subtitle?: string | null;
  templateTypeLabel: string;
  category: string;
  sections: FormPdfSection[];
  otherFields: FormPdfField[];
}

// Export PDF al șablonului gol (nu al unei cereri depuse) — versiunea tipăribilă a
// formularului, cu o linie de completat pentru fiecare câmp, folosită de Editorul de
// șabloane pentru previzualizare/tipărire înainte de publicare (analog graficului de
// flux din Workflow Builder, dar pentru domeniul Form Builder).
export function generateFormPdf(input: FormPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(input.institutionName, { align: "center" })
      .moveDown(0.3)
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6A6F78")
      .text(`${input.templateTypeLabel} · categorie: ${input.category}`, { align: "center" })
      .fillColor("#000")
      .moveDown(1.2);

    doc.font("Helvetica-Bold").fontSize(17).text(input.title);
    if (input.subtitle) {
      doc.font("Helvetica").fontSize(11).fillColor("#6A6F78").text(input.subtitle).fillColor("#000");
    }
    doc.moveDown(1);

    function renderField(field: FormPdfField) {
      doc.font("Helvetica-Bold").fontSize(10.5).text(field.label + (field.required ? " *" : ""));
      if (field.helpText) {
        doc.font("Helvetica").fontSize(8.5).fillColor("#6A6F78").text(field.helpText).fillColor("#000");
      }
      doc.moveDown(0.3);
      const lineY = doc.y + 12;
      doc
        .moveTo(doc.x, lineY)
        .lineTo(doc.x + 480, lineY)
        .dash(2, { space: 2 })
        .stroke("#A0A5AD")
        .undash();
      doc.y = lineY + 14;
    }

    for (const section of input.sections) {
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#e85a0c").text(section.name.toUpperCase()).fillColor("#000");
      doc.moveDown(0.4);
      section.fields.forEach(renderField);
      doc.moveDown(0.4);
    }

    if (input.otherFields.length) {
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#e85a0c").text("ALTE CERINȚE").fillColor("#000");
      doc.moveDown(0.4);
      input.otherFields.forEach(renderField);
    }

    doc.moveDown(1);
    doc
      .fontSize(8.5)
      .fillColor("#6A6F78")
      .text("* câmp obligatoriu · document generat automat din Editorul de șabloane, exclusiv pentru previzualizare/tipărire.", { align: "left" });

    doc.end();
  });
}
