// Modul Anuarul Sportului (4.5.6) — publicație oficială anuală, generată exclusiv din
// date reale validate (fără calcul manual), cu validare pre-publicare (Provizoriu →
// Validat → Oficial) și versiuni istorice imuabile. Almanah Online = partea publică.
import { Router } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "../../shared/prisma";
import { requireAuth, optionalAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";
import { generateYearbookPdf } from "./yearbookPdf";

export const yearbookRouter = Router();

const AGE_BANDS = [
  { label: "Sub 16 ani", max: 16 },
  { label: "16-18 ani", max: 19 },
  { label: "19-23 ani", max: 24 },
  { label: "Seniori (24+)", max: Infinity },
];

function ageCategoryFor(birthDate: Date | null, atDate: Date): string {
  if (!birthDate) return "Necunoscută";
  let age = atDate.getFullYear() - birthDate.getFullYear();
  const hadBirthdayThisYear =
    atDate.getMonth() > birthDate.getMonth() || (atDate.getMonth() === birthDate.getMonth() && atDate.getDate() >= birthDate.getDate());
  if (!hadBirthdayThisYear) age--;
  return AGE_BANDS.find((b) => age < b.max)?.label || "Necunoscută";
}

function medalBucket(medal: string): "gold" | "silver" | "bronze" | null {
  const m = medal.toUpperCase();
  if (m.includes("AUR") || m.includes("GOLD")) return "gold";
  if (m.includes("ARGINT") || m.includes("SILVER")) return "silver";
  if (m.includes("BRONZ") || m.includes("BRONZE")) return "bronze";
  return null;
}

// Agregă LIVE din date reale — nu există calcul manual, doar recalculare la cerere.
async function buildSnapshot(year: number) {
  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year + 1}-01-01`);

  const results = await prisma.athleteCompetitionResult.findMany({
    where: { date: { gte: start, lt: end } },
    include: { athlete: { include: { club: { include: { federation: true } } } } },
  });

  const federationMap = new Map<string, { federationId: string; name: string; disciplineType: string; athleteIds: Set<string>; resultCount: number; medalCount: number }>();
  const countyMap = new Map<string, { county: string; clubIds: Set<string>; medalCount: number }>();
  const athleteMap = new Map<string, { athleteId: string; name: string; clubName: string | null; medalCount: number; gold: number; silver: number; bronze: number }>();
  const ageMap = new Map<string, { category: string; athleteIds: Set<string>; medalCount: number }>();
  const medalMap = new Map<string, number>();

  for (const r of results) {
    const athlete = r.athlete;
    const club = athlete.club;
    const federation = club?.federation;
    const hasMedal = !!r.medal;

    if (federation) {
      if (!federationMap.has(federation.id)) {
        federationMap.set(federation.id, { federationId: federation.id, name: federation.name, disciplineType: federation.disciplineType, athleteIds: new Set(), resultCount: 0, medalCount: 0 });
      }
      const f = federationMap.get(federation.id)!;
      f.athleteIds.add(athlete.id);
      f.resultCount++;
      if (hasMedal) f.medalCount++;
    }

    if (club?.county) {
      if (!countyMap.has(club.county)) countyMap.set(club.county, { county: club.county, clubIds: new Set(), medalCount: 0 });
      const c = countyMap.get(club.county)!;
      c.clubIds.add(club.id);
      if (hasMedal) c.medalCount++;
    }

    if (!athleteMap.has(athlete.id)) {
      athleteMap.set(athlete.id, { athleteId: athlete.id, name: `${athlete.firstName} ${athlete.lastName}`, clubName: club?.name ?? null, medalCount: 0, gold: 0, silver: 0, bronze: 0 });
    }
    const a = athleteMap.get(athlete.id)!;
    if (hasMedal) {
      a.medalCount++;
      const bucket = medalBucket(r.medal!);
      if (bucket) a[bucket]++;
    }

    const cat = ageCategoryFor(athlete.birthDate, r.date);
    if (!ageMap.has(cat)) ageMap.set(cat, { category: cat, athleteIds: new Set(), medalCount: 0 });
    const ageRow = ageMap.get(cat)!;
    ageRow.athleteIds.add(athlete.id);
    if (hasMedal) ageRow.medalCount++;

    if (hasMedal) medalMap.set(r.medal!, (medalMap.get(r.medal!) || 0) + 1);
  }

  const facilities = await prisma.sportsFacility.findMany();
  const facilityOwnerMap = new Map<string, number>();
  for (const f of facilities) {
    const key = f.ownerType || "Neprecizat";
    facilityOwnerMap.set(key, (facilityOwnerMap.get(key) || 0) + 1);
  }

  const snapshot = {
    year,
    generatedAt: new Date().toISOString(),
    rankings: {
      byFederation: [...federationMap.values()]
        .map((f) => ({ federationId: f.federationId, name: f.name, disciplineType: f.disciplineType, athleteCount: f.athleteIds.size, resultCount: f.resultCount, medalCount: f.medalCount }))
        .sort((a, b) => b.medalCount - a.medalCount),
      byCounty: [...countyMap.values()]
        .map((c) => ({ county: c.county, clubCount: c.clubIds.size, medalCount: c.medalCount }))
        .sort((a, b) => b.medalCount - a.medalCount),
      byAthlete: [...athleteMap.values()].sort((a, b) => b.medalCount - a.medalCount).slice(0, 50),
      byAgeCategory: [...ageMap.values()].map((a) => ({ category: a.category, athleteCount: a.athleteIds.size, medalCount: a.medalCount })),
      byMedalType: [...medalMap.entries()].map(([medal, count]) => ({ medal, count })),
      byFacilityOwner: [...facilityOwnerMap.entries()].map(([ownerType, facilityCount]) => ({ ownerType, facilityCount })),
    },
  };

  // Semnalare automată a datelor lipsă (cerință explicită pre-publicare).
  const warnings: { entity: string; id: string; field: string }[] = [];
  (await prisma.sportsClub.findMany({ where: { county: null } })).forEach((c) => warnings.push({ entity: "SportsClub", id: c.id, field: "county" }));
  (await prisma.athlete.findMany({ where: { birthDate: null, gdprErasedAt: null } })).forEach((a) => warnings.push({ entity: "Athlete", id: a.id, field: "birthDate" }));
  (await prisma.sportsFacility.findMany({ where: { ownerType: null } })).forEach((f) => warnings.push({ entity: "SportsFacility", id: f.id, field: "ownerType" }));
  const federationIdsWithResults = new Set(federationMap.keys());
  (await prisma.sportsFederation.findMany()).filter((f) => !federationIdsWithResults.has(f.id)).forEach((f) => warnings.push({ entity: "SportsFederation", id: f.id, field: "results" }));

  return { snapshot, warnings };
}

const generateSchema = z.object({ year: z.number().int().optional() });

yearbookRouter.post("/yearbook/generate", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const year = parsed.data.year || new Date().getFullYear();

  const { snapshot, warnings } = await buildSnapshot(year);
  const lastVersion = await prisma.sportsYearbookEdition.findFirst({ where: { year }, orderBy: { version: "desc" } });
  const version = (lastVersion?.version || 0) + 1;

  const edition = await prisma.sportsYearbookEdition.create({
    data: { year, version, snapshot, missingDataWarnings: warnings, generatedById: req.user!.id },
  });

  await logAction({ userId: req.user!.id, action: "YEARBOOK_EDITION_GENERATED", resource: `yearbook:${edition.id}`, metadata: { year, version, warningCount: warnings.length } });
  res.status(201).json(edition);
});

yearbookRouter.get("/yearbook/editions", requireAuth, requireStaff(), async (_req, res) => {
  const editions = await prisma.sportsYearbookEdition.findMany({
    include: { generatedBy: { select: { id: true, name: true, email: true } } },
    orderBy: [{ year: "desc" }, { version: "desc" }],
  });
  res.json(editions);
});

yearbookRouter.get("/yearbook/editions/:id", requireAuth, requireStaff(), async (req, res) => {
  const edition = await prisma.sportsYearbookEdition.findUnique({ where: { id: req.params.id } });
  if (!edition) return res.status(404).json({ error: "Ediție inexistentă" });
  res.json(edition);
});

const STATUS_ORDER = ["PROVIZORIU", "VALIDAT", "OFICIAL"];
const statusSchema = z.object({ status: z.enum(["VALIDAT", "OFICIAL"]), force: z.boolean().optional() });

yearbookRouter.patch("/yearbook/editions/:id/status", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const edition = await prisma.sportsYearbookEdition.findUnique({ where: { id: req.params.id } });
  if (!edition) return res.status(404).json({ error: "Ediție inexistentă" });

  if (STATUS_ORDER.indexOf(parsed.data.status) !== STATUS_ORDER.indexOf(edition.status) + 1) {
    return res.status(409).json({ error: "Tranziție de stare invalidă (ordinea e Provizoriu → Validat → Oficial)" });
  }

  const warnings = (edition.missingDataWarnings as unknown as any[]) || [];
  if (warnings.length > 0 && !parsed.data.force) {
    return res.status(409).json({ error: "Există date lipsă nesemnalate — retrimite cu force=true pentru a continua oricum", warnings });
  }

  const updated = await prisma.sportsYearbookEdition.update({
    where: { id: edition.id },
    data: {
      status: parsed.data.status,
      validatedAt: parsed.data.status === "VALIDAT" ? new Date() : edition.validatedAt,
      publishedAt: parsed.data.status === "OFICIAL" ? new Date() : edition.publishedAt,
    },
  });

  await logAction({ userId: req.user!.id, action: "YEARBOOK_STATUS_CHANGED", resource: `yearbook:${updated.id}`, metadata: { status: updated.status } });
  res.json(updated);
});

// Almanah Online — public, fără autentificare (Scenariul cerut explicit "dashboard public").
yearbookRouter.get("/yearbook/public", async (_req, res) => {
  const latest = await prisma.sportsYearbookEdition.findFirst({ where: { status: "OFICIAL" }, orderBy: [{ year: "desc" }, { version: "desc" }] });
  const history = await prisma.sportsYearbookEdition.findMany({
    where: { status: "OFICIAL" },
    select: { id: true, year: true, version: true, publishedAt: true },
    orderBy: [{ year: "desc" }, { version: "desc" }],
  });
  res.json({ latest, history });
});

yearbookRouter.get("/yearbook/editions/:id/export.pdf", requireAuth, requireStaff(), async (req, res) => {
  const edition = await prisma.sportsYearbookEdition.findUnique({ where: { id: req.params.id } });
  if (!edition) return res.status(404).json({ error: "Ediție inexistentă" });
  const pdfBuffer = await generateYearbookPdf(edition.snapshot as any);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="anuar-sportului-${edition.year}-v${edition.version}.pdf"`);
  res.send(pdfBuffer);
});

yearbookRouter.get("/yearbook/editions/:id/export.xlsx", requireAuth, requireStaff(), async (req, res) => {
  const edition = await prisma.sportsYearbookEdition.findUnique({ where: { id: req.params.id } });
  if (!edition) return res.status(404).json({ error: "Ediție inexistentă" });
  const snapshot = edition.snapshot as any;

  const workbook = new ExcelJS.Workbook();

  const wsFed = workbook.addWorksheet("Federații");
  wsFed.columns = [
    { header: "Federație", key: "name", width: 30 },
    { header: "Disciplină", key: "disciplineType", width: 20 },
    { header: "Sportivi", key: "athleteCount", width: 12 },
    { header: "Rezultate", key: "resultCount", width: 12 },
    { header: "Medalii", key: "medalCount", width: 12 },
  ];
  wsFed.addRows(snapshot.rankings.byFederation);

  const wsCounty = workbook.addWorksheet("Județe");
  wsCounty.columns = [
    { header: "Județ", key: "county", width: 20 },
    { header: "Cluburi", key: "clubCount", width: 12 },
    { header: "Medalii", key: "medalCount", width: 12 },
  ];
  wsCounty.addRows(snapshot.rankings.byCounty);

  const wsAthlete = workbook.addWorksheet("Sportivi");
  wsAthlete.columns = [
    { header: "Sportiv", key: "name", width: 30 },
    { header: "Club", key: "clubName", width: 25 },
    { header: "Medalii", key: "medalCount", width: 12 },
    { header: "Aur", key: "gold", width: 8 },
    { header: "Argint", key: "silver", width: 8 },
    { header: "Bronz", key: "bronze", width: 8 },
  ];
  wsAthlete.addRows(snapshot.rankings.byAthlete);

  const wsAge = workbook.addWorksheet("Categorii vârstă");
  wsAge.columns = [
    { header: "Categorie", key: "category", width: 20 },
    { header: "Sportivi", key: "athleteCount", width: 12 },
    { header: "Medalii", key: "medalCount", width: 12 },
  ];
  wsAge.addRows(snapshot.rankings.byAgeCategory);

  const wsFacility = workbook.addWorksheet("Unități sportive");
  wsFacility.columns = [
    { header: "Deținător", key: "ownerType", width: 25 },
    { header: "Nr. unități", key: "facilityCount", width: 12 },
  ];
  wsFacility.addRows(snapshot.rankings.byFacilityOwner);

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="anuar-sportului-${edition.year}-v${edition.version}.xlsx"`);
  res.send(Buffer.from(buffer));
});

// Profil public automat sportiv/antrenor — căutare după nume (Almanah Online).
yearbookRouter.get("/yearbook/athletes/search", optionalAuth, async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) return res.json([]);

  const athletes = await prisma.athlete.findMany({
    where: { gdprErasedAt: null, OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] },
    include: { club: { select: { name: true, federation: { select: { name: true } } } }, results: { orderBy: { date: "desc" } } },
    take: 20,
  });

  res.json(
    athletes.map((a) => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`,
      club: a.club?.name ?? null,
      federation: a.club?.federation?.name ?? null,
      status: a.status,
      results: a.results.map((r) => ({ competitionName: r.competitionName, date: r.date, result: r.result, medal: r.medal })),
    }))
  );
});
