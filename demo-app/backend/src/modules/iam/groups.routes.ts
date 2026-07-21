import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, requireRole, AuthedRequest } from "./rbac.middleware";
import { logAction } from "./audit.service";

export const groupsRouter = Router();

const groupInclude = {
  members: { include: { user: { select: { id: true, email: true, name: true } } } },
};

groupsRouter.get(
  "/groups",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (_req, res) => {
    const groups = await prisma.group.findMany({ include: groupInclude, orderBy: { name: "asc" } });
    res.json(groups);
  }
);

const createGroupSchema = z.object({ name: z.string().min(1) });

groupsRouter.post(
  "/groups",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (req: AuthedRequest, res) => {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = await prisma.group.findUnique({ where: { name: parsed.data.name } });
    if (existing) return res.status(409).json({ error: "Există deja un grup cu acest nume" });
    const group = await prisma.group.create({ data: { name: parsed.data.name }, include: groupInclude });
    await logAction({ userId: req.user!.id, action: "GROUP_CREATED", resource: `group:${group.id}`, metadata: { name: group.name } });
    res.status(201).json(group);
  }
);

groupsRouter.delete(
  "/groups/:id",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (req: AuthedRequest, res) => {
    await prisma.group.delete({ where: { id: req.params.id } });
    await logAction({ userId: req.user!.id, action: "GROUP_DELETED", resource: `group:${req.params.id}` });
    res.status(204).end();
  }
);

const memberSchema = z.object({ userId: z.string().min(1) });

groupsRouter.post(
  "/groups/:id/members",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (req: AuthedRequest, res) => {
    const parsed = memberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const membership = await prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: parsed.data.userId, groupId: req.params.id } },
      update: {},
      create: { userId: parsed.data.userId, groupId: req.params.id },
    });
    await logAction({
      userId: req.user!.id,
      action: "GROUP_MEMBER_ADDED",
      resource: `group:${req.params.id}`,
      metadata: { memberId: parsed.data.userId },
    });
    res.status(201).json(membership);
  }
);

groupsRouter.delete(
  "/groups/:id/members/:userId",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (req: AuthedRequest, res) => {
    await prisma.groupMembership.delete({
      where: { userId_groupId: { userId: req.params.userId, groupId: req.params.id } },
    });
    await logAction({
      userId: req.user!.id,
      action: "GROUP_MEMBER_REMOVED",
      resource: `group:${req.params.id}`,
      metadata: { memberId: req.params.userId },
    });
    res.status(204).end();
  }
);
