import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireAdmin, requireStaff } from "./rbac";

export const registriesRouter = Router();

// Registrele de numerotare (intrare/intern/ieșire) — configurabile din Registratură:
// nume, cod (prefix, garantează unicitatea între registre), numărul de pornire.
registriesRouter.get("/registries", requireAuth, requireStaff(), async (_req, res) => {
  const registries = await prisma.numberingRegistry.findMany({
    include: { yearCounters: { where: { year: new Date().getFullYear() } } },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
  res.json(
    registries.map((r) => ({
      ...r,
      currentYearLastNumber: r.yearCounters[0]?.lastNumber ?? null,
      yearCounters: undefined,
    }))
  );
});

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().max(20).regex(/^[A-Z0-9]*$/, "Codul poate conține doar litere mari și cifre"),
  kind: z.enum(["INTRARE", "INTERN", "IESIRE"]),
  startNumber: z.number().int().min(1),
  isDefault: z.boolean().optional(),
});

registriesRouter.post("/registries", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // INTRARE și INTERN scriu în aceeași coloană unică (DmsRequest.registryNumber) — codul
  // lor nu poate coincide cu al niciunui alt registru din aceste două serii. IESIRE scrie
  // în altă coloană (fără constrângere unică) și poate refolosi orice cod, independent.
  if (parsed.data.kind !== "IESIRE") {
    const collision = await prisma.numberingRegistry.findFirst({
      where: { code: parsed.data.code, kind: { in: ["INTRARE", "INTERN"] } },
    });
    if (collision) return res.status(409).json({ error: "Există deja un registru de intrare/intern cu acest cod" });
  }

  const registry = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      // Un singur registru implicit per serie — dezactivăm orice alt implicit existent.
      await tx.numberingRegistry.updateMany({ where: { kind: parsed.data.kind, isDefault: true }, data: { isDefault: false } });
    }
    return tx.numberingRegistry.create({ data: parsed.data });
  });

  await logAction({ userId: req.user!.id, action: "REGISTRY_CREATED", resource: `registry:${registry.id}`, metadata: { name: registry.name, code: registry.code } });
  res.status(201).json(registry);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  startNumber: z.number().int().min(1).optional(),
  isDefault: z.boolean().optional(),
});

// Codul și seria (kind) nu se pot schimba după creare — ar rupe sensul numerelor deja emise.
registriesRouter.patch("/registries/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const registry = await prisma.numberingRegistry.findUnique({ where: { id: req.params.id } });
  if (!registry) return res.status(404).json({ error: "Registru inexistent" });

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.numberingRegistry.updateMany({ where: { kind: registry.kind, isDefault: true, id: { not: registry.id } }, data: { isDefault: false } });
    }
    return tx.numberingRegistry.update({ where: { id: registry.id }, data: parsed.data });
  });

  await logAction({ userId: req.user!.id, action: "REGISTRY_UPDATED", resource: `registry:${updated.id}` });
  res.json(updated);
});
