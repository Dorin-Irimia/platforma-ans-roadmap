import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, optionalAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";

// CMS pagini publice (4.5.1 R59-62) — Termeni și condiții/Politică de confidențialitate/
// Contact + orice altă pagină publică administrabilă. `bodyHtml` e scris cu editorul
// TipTap pe frontend (același tipar de stocare/sanitizare ca blocurile TEXT din LMS).
export const cmsRouter = Router();

const pageSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Doar litere mici, cifre și cratimă"),
  title: z.string().min(1),
  bodyHtml: z.string(),
  titleEn: z.string().optional(),
  bodyHtmlEn: z.string().optional(),
  isPublished: z.boolean().optional(),
});

cmsRouter.get("/cms/pages", requireAuth, requireStaff(), async (_req, res) => {
  const pages = await prisma.cmsPage.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(pages);
});

cmsRouter.post("/cms/pages", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = pageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.cmsPage.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) return res.status(409).json({ error: "Există deja o pagină cu acest slug" });
  const page = await prisma.cmsPage.create({ data: parsed.data });
  await logAction({ userId: req.user!.id, action: "CMS_PAGE_CREATED", resource: `cms-page:${page.id}` });
  res.status(201).json(page);
});

cmsRouter.patch("/cms/pages/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = pageSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const page = await prisma.cmsPage.update({ where: { id: req.params.id }, data: parsed.data });
  await logAction({ userId: req.user!.id, action: "CMS_PAGE_UPDATED", resource: `cms-page:${page.id}` });
  res.json(page);
});

cmsRouter.delete("/cms/pages/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  await prisma.cmsPage.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
});

// Randare publică — doar pagini publicate, accesibile fără autentificare (R60/R29).
cmsRouter.get("/cms/pages/:slug", optionalAuth, async (req, res) => {
  const page = await prisma.cmsPage.findUnique({ where: { slug: req.params.slug } });
  if (!page || !page.isPublished) return res.status(404).json({ error: "Pagină inexistentă" });
  res.json(page);
});

// Seed inițial (paginile obligatorii, R62) — apelat lenes la primul GET al listei admin,
// același tipar de "singleton seed" ca AuthPolicySettings/AiSettings.
const MANDATORY_PAGES = [
  { slug: "termeni-si-conditii", title: "Termeni și condiții", bodyHtml: "<p>Conținut termeni și condiții — de completat.</p>" },
  { slug: "politica-de-confidentialitate", title: "Politică de confidențialitate", bodyHtml: "<p>Conținut politică de confidențialitate — de completat.</p>" },
  { slug: "contact", title: "Contact", bodyHtml: "<p>Str. Vasile Conta, Nr. 16, Sector 2, București</p>" },
];

cmsRouter.post("/cms/pages/seed-mandatory", requireAuth, requireStaff(), async (_req, res) => {
  const created = [];
  for (const p of MANDATORY_PAGES) {
    const existing = await prisma.cmsPage.findUnique({ where: { slug: p.slug } });
    if (!existing) created.push(await prisma.cmsPage.create({ data: { ...p, isPublished: true } }));
  }
  res.json({ created: created.length, pages: created });
});
