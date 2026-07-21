// Aplicarea efectivă a semnăturii electronice pe PDF — pdf-lib poate încărca un
// PDF existent și desena peste el la coordonate exacte, ceea ce îl face potrivit
// pentru a "ștampila" o semnătură la poziția aleasă de utilizator în preview
// (același principiu ca DocuSign/PandaDoc: poziție relativă → coordonate absolute
// PDF la momentul randării finale). Semnătura e un mock vizual (nu o semnătură
// criptografică PAdES reală) — suficient pentru scopul demonstrativ al Scenariului 1.
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface StampInput {
  pdfBytes: Buffer;
  page: number; // 0-indexat
  xRatio: number;
  yRatio: number; // de sus în jos
  widthRatio: number;
  heightRatio: number;
  signerName: string;
  signedAtIso: string;
}

export async function stampSignature(input: StampInput): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(input.pdfBytes);
  const pages = pdfDoc.getPages();
  const pageIndex = Math.min(Math.max(input.page, 0), pages.length - 1);
  const page = pages[pageIndex];
  const { width: pageWidth, height: pageHeight } = page.getSize();

  const boxWidth = input.widthRatio * pageWidth;
  const boxHeight = input.heightRatio * pageHeight;
  const x = input.xRatio * pageWidth;
  // pdf-lib originea e jos-stânga; coordonatele noastre (xRatio/yRatio) sunt de sus-stânga (ca în CSS/DOM) — convertim.
  const yTop = input.yRatio * pageHeight;
  const y = pageHeight - yTop - boxHeight;

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x,
    y,
    width: boxWidth,
    height: boxHeight,
    borderColor: rgb(0.18, 0.19, 0.57), // indigo
    borderWidth: 1,
    color: rgb(0.93, 0.94, 0.98),
  });

  const signedDate = new Date(input.signedAtIso).toLocaleString("ro-RO");

  page.drawText("Semnat electronic", {
    x: x + 6,
    y: y + boxHeight - 14,
    size: 8,
    font: boldFont,
    color: rgb(0.18, 0.19, 0.57),
  });
  page.drawText(input.signerName, {
    x: x + 6,
    y: y + boxHeight - 28,
    size: 10,
    font,
    color: rgb(0.06, 0.07, 0.09),
  });
  page.drawText(signedDate, {
    x: x + 6,
    y: y + 6,
    size: 7,
    font,
    color: rgb(0.42, 0.44, 0.47),
  });

  const stamped = await pdfDoc.save();
  return Buffer.from(stamped);
}
