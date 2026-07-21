// Fundamentare (grounding) pe date publice reale — cerință explicită 4.5.11: chatbot-ul
// trebuie să răspundă pe baza informațiilor publice din Registrul Sportiv, Registrul
// Sportivilor/Antrenorilor, Registrul Bazelor Sportive, Anuarul Sportului — nu doar din
// documente încărcate manual. Rutele sports-registry sunt toate requireStaff() (fără API
// public), deci interogăm direct modelele Prisma aici (același tipar cross-modul deja
// folosit de dms/caseEngine.ts, care scrie deja direct în aceleași modele) — fără CNP-uri
// sau alte date sensibile, doar informații deja tratate ca publice de restul platformei
// (nume, disciplină, apartenență, clasamente din ediția oficială a Anuarului).
import { prisma } from "../../shared/prisma";

const MAX_FEDERATIONS = 30;
const MAX_FACILITIES = 30;

export async function buildRegistryContext(): Promise<string> {
  const [federations, facilities, yearbookEdition] = await Promise.all([
    prisma.sportsFederation.findMany({
      take: MAX_FEDERATIONS,
      include: { clubs: { select: { name: true, county: true }, take: 20 } },
      orderBy: { name: "asc" },
    }),
    prisma.sportsFacility.findMany({
      take: MAX_FACILITIES,
      select: { name: true, category: true, county: true, status: true },
      orderBy: { name: "asc" },
    }),
    prisma.sportsYearbookEdition.findFirst({
      where: { status: "OFICIAL" },
      orderBy: [{ year: "desc" }, { version: "desc" }],
    }),
  ]);

  const parts: string[] = [];

  if (federations.length) {
    parts.push(
      "Federații sportive și cluburile afiliate (Registrul Sportiv):\n" +
        federations
          .map((f) => `- ${f.name} (${f.disciplineType}, ${f.status})` + (f.clubs.length ? `: ${f.clubs.map((c) => c.name).join(", ")}` : ""))
          .join("\n")
    );
  }

  if (facilities.length) {
    parts.push(
      "Baze sportive (Registrul Bazelor Sportive):\n" +
        facilities.map((f) => `- ${f.name} (categoria ${f.category}, județul ${f.county}, status ${f.status})`).join("\n")
    );
  }

  if (yearbookEdition) {
    const snapshot = yearbookEdition.snapshot as any;
    const topFederations = (snapshot?.rankings?.byFederation || []).slice(0, 5);
    const topAthletes = (snapshot?.rankings?.byAthlete || []).slice(0, 5);
    parts.push(
      `Anuarul Sportului, ediția oficială ${yearbookEdition.year}:\n` +
        `Top federații după medalii: ${topFederations.map((f: any) => `${f.name} (${f.medalCount})`).join(", ") || "fără date"}\n` +
        `Top sportivi după medalii: ${topAthletes.map((a: any) => `${a.name} (${a.medalCount})`).join(", ") || "fără date"}`
    );
  }

  return parts.join("\n\n");
}
