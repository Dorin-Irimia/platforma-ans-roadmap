import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireStaff } from "./rbac";

export const commentsRouter = Router();

const commentSchema = z.object({ body: z.string().min(1) });

function extractMentions(body: string): string[] {
  const matches = body.match(/@[\w.+-]+@?[\w.-]*/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
}

// Comunicare contextuală: comentarii și mențiuni (@user) pe documente (pct. 13, Scenariul 1).
commentsRouter.post("/requests/:id/comments", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const comment = await prisma.documentComment.create({
    data: {
      requestId: req.params.id,
      authorId: req.user!.id,
      body: parsed.data.body,
      mentions: extractMentions(parsed.data.body),
    },
    include: { author: { select: { id: true, email: true, name: true } } },
  });

  await logAction({ userId: req.user!.id, action: "COMMENT_ADDED", resource: `request:${req.params.id}` });
  res.status(201).json(comment);
});

commentsRouter.get("/requests/:id/comments", requireAuth, requireStaff(), async (req, res) => {
  const comments = await prisma.documentComment.findMany({
    where: { requestId: req.params.id },
    include: { author: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(comments);
});
