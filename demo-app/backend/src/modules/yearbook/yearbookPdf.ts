// Export PDF al unei ediții a Anuarului Sportului — aceeași tehnică PDFKit ca dms/pdf.ts.
import PDFDocument from "pdfkit";

interface YearbookSnapshot {
  year: number;
  rankings: {
    byFederation: { name: string; disciplineType: string; athleteCount: number; resultCount: number; medalCount: number }[];
    byCounty: { county: string; clubCount: number; medalCount: number }[];
    byAthlete: { name: string; clubName: string | null; medalCount: number; gold: number; silver: number; bronze: number }[];
    byAgeCategory: { category: string; athleteCount: number; medalCount: number }[];
    byMedalType: { medal: string; count: number }[];
    byFacilityOwner: { ownerType: string; facilityCount: number }[];
  };
}

function renderSection(doc: PDFKit.PDFDocument, title: string, rows: string[]) {
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#e85a0c").text(title.toUpperCase()).fillColor("#000");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10);
  if (rows.length === 0) {
    doc.fillColor("#6A6F78").text("Fără date.").fillColor("#000");
  } else {
    rows.forEach((r) => doc.text(r));
  }
  doc.moveDown(1);
}

export function generateYearbookPdf(snapshot: YearbookSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("ANUARUL SPORTULUI", { align: "center" })
      .moveDown(0.2)
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#6A6F78")
      .text(`Ediția ${snapshot.year}`, { align: "center" })
      .fillColor("#000")
      .moveDown(2);

    renderSection(
      doc,
      "Clasament pe federații",
      snapshot.rankings.byFederation.map((f) => `${f.name} (${f.disciplineType}) — ${f.athleteCount} sportivi, ${f.resultCount} rezultate, ${f.medalCount} medalii`)
    );
    renderSection(
      doc,
      "Clasament pe județe",
      snapshot.rankings.byCounty.map((c) => `${c.county} — ${c.clubCount} cluburi, ${c.medalCount} medalii`)
    );
    doc.addPage();
    renderSection(
      doc,
      "Clasament individual sportivi",
      snapshot.rankings.byAthlete.map((a, i) => `${i + 1}. ${a.name}${a.clubName ? ` (${a.clubName})` : ""} — ${a.medalCount} medalii (${a.gold} aur, ${a.silver} argint, ${a.bronze} bronz)`)
    );
    renderSection(
      doc,
      "Pe categorii de vârstă",
      snapshot.rankings.byAgeCategory.map((a) => `${a.category} — ${a.athleteCount} sportivi, ${a.medalCount} medalii`)
    );
    renderSection(
      doc,
      "Pe tip de medalie",
      snapshot.rankings.byMedalType.map((m) => `${m.medal} — ${m.count}`)
    );
    renderSection(
      doc,
      "Unități sportive (ANS vs. Ministerul Educației)",
      snapshot.rankings.byFacilityOwner.map((f) => `${f.ownerType} — ${f.facilityCount} unități`)
    );

    doc.moveDown(1);
    doc.fontSize(8.5).fillColor("#6A6F78").text("Generat automat, exclusiv din date validate de la federații/cluburi — fără calcul manual.");

    doc.end();
  });
}
