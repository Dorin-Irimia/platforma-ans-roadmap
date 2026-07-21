// Motor de workflow pe stări+tranziții (model URBIO Workflow Builder) — înlocuiește
// fostul model liniar (WorkflowDefinition/WorkflowStepDef/WorkflowInstance/WorkflowStepInstance).
//
// Structură: WorkflowState e un nomenclator GLOBAL (nume unic pe toată platforma, ca în
// URBIO — odată creată starea "Aprobat", orice alt flux o poate reutiliza). WorkflowDef e
// definiția unui flux (icon/nume/vizibilitate/secțiune/etichete/termen). WorkflowTransition
// e o muchie a grafului de stări (de la o stare, sau START dacă fromStateId e null, la altă
// stare), cu 4 tipuri de comportament automatizat atașat: Șabloane (Form), Validări (5
// tipuri), Acțiuni (12 tipuri), Declanșatori (2 tipuri, evaluați leneș — vezi caseEngine.ts).
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireAdmin, requireStaff } from "./rbac";
import {
  transitionInclude,
  applyTransition,
  evaluateAutoTriggers,
  TransitionGuardError,
} from "./caseEngine";

export const workflowRouter = Router();

// ------------------------------------------------------------
// Stări globale (nomenclator unic pe platformă)
// ------------------------------------------------------------

const stateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]).default("TODO"),
  color: z.string().min(1).default("#64748B"),
  description: z.string().optional(),
});

workflowRouter.get("/workflow-states", requireAuth, requireStaff(), async (_req, res) => {
  const states = await prisma.workflowState.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  res.json(states);
});

workflowRouter.post("/workflow-states", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = stateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const state = await prisma.workflowState.create({ data: parsed.data });
    await logAction({ userId: req.user!.id, action: "WORKFLOW_STATE_CREATED", resource: `workflow-state:${state.id}` });
    res.status(201).json(state);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: `Există deja o stare cu numele „${parsed.data.name}” — numele stărilor sunt unice pe toată platforma` });
    throw err;
  }
});

workflowRouter.patch("/workflow-states/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = stateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const state = await prisma.workflowState.update({ where: { id: req.params.id }, data: parsed.data });
    await logAction({ userId: req.user!.id, action: "WORKFLOW_STATE_UPDATED", resource: `workflow-state:${state.id}` });
    res.json(state);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: "Există deja o stare cu acest nume" });
    if (err.code === "P2025") return res.status(404).json({ error: "Stare inexistentă" });
    throw err;
  }
});

workflowRouter.delete("/workflow-states/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const [fromCount, toCount] = await Promise.all([
    prisma.workflowTransition.count({ where: { fromStateId: req.params.id } }),
    prisma.workflowTransition.count({ where: { toStateId: req.params.id } }),
  ]);
  if (fromCount + toCount > 0) {
    return res.status(409).json({ error: "Starea este folosită de cel puțin o tranziție și nu poate fi ștearsă" });
  }
  await prisma.workflowState.delete({ where: { id: req.params.id } });
  await logAction({ userId: req.user!.id, action: "WORKFLOW_STATE_DELETED", resource: `workflow-state:${req.params.id}` });
  res.status(204).end();
});

// ------------------------------------------------------------
// Grupuri (folosite de acțiunea ASSIGN_TO_GROUP) — nomenclator minimal, reutilizează
// modelul Group deja existent din IAM (Scenariul 4), fără CRUD complet — doar ce e
// necesar pentru a alimenta selectorul din editorul de tranziții.
// ------------------------------------------------------------

workflowRouter.get("/workflow-groups", requireAuth, requireAdmin(), async (_req, res) => {
  const groups = await prisma.group.findMany({ orderBy: { name: "asc" } });
  res.json(groups);
});

workflowRouter.post("/workflow-groups", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const group = await prisma.group.create({ data: parsed.data });
    res.status(201).json(group);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: "Există deja un grup cu acest nume" });
    throw err;
  }
});

// ------------------------------------------------------------
// Definiții de flux (WorkflowDef)
// ------------------------------------------------------------

const reminderSchema = z.object({
  channel: z.enum(["PUSH", "EMAIL"]),
  quantity: z.number().min(1),
  unit: z.enum(["MINUTES", "HOURS", "BUSINESS_DAYS", "MONTHS", "YEARS"]),
});

const workflowDefSchema = z.object({
  icon: z.string().min(1).default("Workflow"),
  name: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).default("PRIVATE"),
  section: z
    .enum([
      "COMPLAINTS",
      "DOC_ISSUANCE",
      "EVENTS",
      "GENERAL",
      "OFFICIAL_GAZETTE",
      "PUBLIC_INFO",
      "PUBLIC_CONSULTATION",
      "REPORTS",
      "SURVEYS",
      "POLLS",
    ])
    .default("GENERAL"),
  tags: z.array(z.string()).default([]),
  category: z.string().min(1),
  dueDateQuantity: z.number().min(1).optional(),
  dueDateUnit: z.enum(["MINUTES", "HOURS", "BUSINESS_DAYS", "MONTHS", "YEARS"]).optional(),
  isActive: z.boolean().default(true),
  reminders: z.array(reminderSchema).default([]),
});

const workflowDefInclude = {
  reminders: true,
  transitions: {
    include: {
      fromState: true,
      toState: true,
      ...transitionInclude,
    },
    orderBy: { order: "asc" as const },
  },
};

workflowRouter.get("/workflow-defs", requireAuth, requireStaff(), async (_req, res) => {
  const defs = await prisma.workflowDef.findMany({
    include: { reminders: true, transitions: { select: { id: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(defs.map((d) => ({ ...d, transitionCount: d.transitions.length, transitions: undefined })));
});

workflowRouter.get("/workflow-defs/:id", requireAuth, requireStaff(), async (req, res) => {
  const def = await prisma.workflowDef.findUnique({ where: { id: req.params.id }, include: workflowDefInclude });
  if (!def) return res.status(404).json({ error: "Flux inexistent" });
  res.json(def);
});

workflowRouter.post("/workflow-defs", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = workflowDefSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { reminders, ...data } = parsed.data;

  const def = await prisma.workflowDef.create({
    data: { ...data, reminders: { create: reminders } },
    include: workflowDefInclude,
  });
  await logAction({ userId: req.user!.id, action: "WORKFLOW_DEF_CREATED", resource: `workflow-def:${def.id}` });
  res.status(201).json(def);
});

const updateWorkflowDefSchema = workflowDefSchema.partial();

workflowRouter.patch("/workflow-defs/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = updateWorkflowDefSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { reminders, ...data } = parsed.data;

  if (reminders) {
    await prisma.workflowReminder.deleteMany({ where: { workflowDefId: req.params.id } });
  }

  const def = await prisma.workflowDef.update({
    where: { id: req.params.id },
    data: { ...data, ...(reminders ? { reminders: { create: reminders } } : {}) },
    include: workflowDefInclude,
  });
  await logAction({ userId: req.user!.id, action: "WORKFLOW_DEF_UPDATED", resource: `workflow-def:${def.id}` });
  res.json(def);
});

workflowRouter.patch("/workflow-defs/:id/active", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const def = await prisma.workflowDef.update({ where: { id: req.params.id }, data: { isActive: parsed.data.isActive } });
  await logAction({
    userId: req.user!.id,
    action: parsed.data.isActive ? "WORKFLOW_DEF_ACTIVATED" : "WORKFLOW_DEF_DEACTIVATED",
    resource: `workflow-def:${def.id}`,
  });
  res.json(def);
});

// Duplicare completă a fluxului: definiție + toate tranzițiile cu Șabloane/Validări/
// Acțiuni/Declanșatori (stările în sine sunt globale, nu se clonează — se refolosesc).
workflowRouter.post("/workflow-defs/:id/duplicate", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const original = await prisma.workflowDef.findUnique({ where: { id: req.params.id }, include: workflowDefInclude });
  if (!original) return res.status(404).json({ error: "Flux inexistent" });

  const clone = await prisma.$transaction(async (tx) => {
    const created = await tx.workflowDef.create({
      data: {
        icon: original.icon,
        name: `${original.name} (copie)`,
        description: original.description,
        visibility: original.visibility,
        section: original.section,
        tags: original.tags,
        category: original.category,
        dueDateQuantity: original.dueDateQuantity,
        dueDateUnit: original.dueDateUnit,
        isActive: false,
        reminders: { create: original.reminders.map((r) => ({ channel: r.channel, quantity: r.quantity, unit: r.unit })) },
      },
    });

    for (const t of original.transitions) {
      const transition = await tx.workflowTransition.create({
        data: {
          workflowDefId: created.id,
          name: t.name,
          fromStateId: t.fromStateId,
          toStateId: t.toStateId,
          requiresComment: t.requiresComment,
          requiresApproval: t.requiresApproval,
          notifySubmitter: t.notifySubmitter,
          order: t.order,
        },
      });
      if (t.templates.length) {
        await tx.workflowTransitionTemplate.createMany({
          data: t.templates.map((tpl) => ({ transitionId: transition.id, formId: tpl.formId, required: tpl.required })),
        });
      }
      if (t.validations.length) {
        await tx.workflowValidation.createMany({
          data: t.validations.map((v) => ({ transitionId: transition.id, type: v.type, config: v.config ?? undefined, order: v.order })),
        });
      }
      if (t.actions.length) {
        await tx.workflowAction.createMany({
          data: t.actions.map((a) => ({ transitionId: transition.id, type: a.type, config: a.config ?? undefined, order: a.order })),
        });
      }
      if (t.triggers.length) {
        await tx.workflowTrigger.createMany({
          data: t.triggers.map((tr) => ({ transitionId: transition.id, type: tr.type, config: tr.config ?? undefined })),
        });
      }
    }

    return tx.workflowDef.findUniqueOrThrow({ where: { id: created.id }, include: workflowDefInclude });
  });

  await logAction({ userId: req.user!.id, action: "WORKFLOW_DEF_DUPLICATED", resource: `workflow-def:${clone.id}`, metadata: { originalId: original.id } });
  res.status(201).json(clone);
});

workflowRouter.delete("/workflow-defs/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const casesCount = await prisma.workflowCase.count({ where: { workflowDefId: req.params.id } });
  if (casesCount > 0) {
    return res.status(409).json({ error: "Fluxul are cazuri active/istorice și nu poate fi șters — îl puteți dezactiva în schimb" });
  }
  await prisma.workflowDef.delete({ where: { id: req.params.id } });
  await logAction({ userId: req.user!.id, action: "WORKFLOW_DEF_DELETED", resource: `workflow-def:${req.params.id}` });
  res.status(204).end();
});

// ------------------------------------------------------------
// Tranziții (muchii ale grafului de stări) — cu Șabloane/Validări/Acțiuni/Declanșatori
// ------------------------------------------------------------

const templateRefSchema = z.object({ formId: z.string(), required: z.boolean().default(true) });
const validationSchema = z.object({
  type: z.enum(["VALIDATE_TEMPLATE", "VALIDATE_FIELD", "VALIDATE_UNIQUENESS", "MANUAL_CHECKLIST", "VALIDATE_SIGNATURE"]),
  config: z.any().optional(),
  order: z.number().default(0),
});
const actionSchema = z.object({
  type: z.enum([
    "SEND_EMAIL",
    "SEND_NOTIFICATION",
    "GENERATE_DOCUMENT",
    "ASSIGN_TO_USER",
    "ASSIGN_TO_GROUP",
    "SET_DUE_DATE",
    "REQUEST_SIGNATURE",
    "PUBLISH_TO_PORTAL",
    "CREATE_CALENDAR_EVENT",
    "ADD_TAG",
    "LOCK_REQUEST",
    "ARCHIVE_REQUEST",
    "ISSUE_CIS",
    "ACTIVATE_FACILITY",
    "GRANT_COACH_TITLE",
    "APPROVE_TRANSFER",
  ]),
  config: z.any().optional(),
  order: z.number().default(0),
});
const triggerSchema = z.object({
  type: z.enum(["RESPONSE_THRESHOLD", "DURATION_IN_STATE", "DEADLINE_OVERDUE"]),
  config: z.any().optional(),
});

const transitionSchema = z.object({
  name: z.string().min(1),
  fromStateId: z.string().nullable(),
  toStateId: z.string(),
  requiresComment: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  notifySubmitter: z.boolean().default(true),
  order: z.number().default(0),
  templates: z.array(templateRefSchema).default([]),
  validations: z.array(validationSchema).default([]),
  actions: z.array(actionSchema).default([]),
  triggers: z.array(triggerSchema).default([]),
});

const fullTransitionInclude = { fromState: true, toState: true, ...transitionInclude };

workflowRouter.post("/workflow-defs/:id/transitions", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { templates, validations, actions, triggers, ...data } = parsed.data;

  const transition = await prisma.workflowTransition.create({
    data: {
      ...data,
      workflowDefId: req.params.id,
      templates: { create: templates },
      validations: { create: validations },
      actions: { create: actions },
      triggers: { create: triggers },
    },
    include: fullTransitionInclude,
  });
  await logAction({ userId: req.user!.id, action: "WORKFLOW_TRANSITION_CREATED", resource: `workflow-transition:${transition.id}` });
  res.status(201).json(transition);
});

workflowRouter.patch("/workflow-transitions/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = transitionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { templates, validations, actions, triggers, ...data } = parsed.data;

  // Cel mai simplu mod corect de a sincroniza listele imbricate: le ștergem și le
  // recreăm (același tipar folosit deja la secțiunile/câmpurile de formular).
  if (templates) await prisma.workflowTransitionTemplate.deleteMany({ where: { transitionId: req.params.id } });
  if (validations) await prisma.workflowValidation.deleteMany({ where: { transitionId: req.params.id } });
  if (actions) await prisma.workflowAction.deleteMany({ where: { transitionId: req.params.id } });
  if (triggers) await prisma.workflowTrigger.deleteMany({ where: { transitionId: req.params.id } });

  const transition = await prisma.workflowTransition.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(templates ? { templates: { create: templates } } : {}),
      ...(validations ? { validations: { create: validations } } : {}),
      ...(actions ? { actions: { create: actions } } : {}),
      ...(triggers ? { triggers: { create: triggers } } : {}),
    },
    include: fullTransitionInclude,
  });
  await logAction({ userId: req.user!.id, action: "WORKFLOW_TRANSITION_UPDATED", resource: `workflow-transition:${transition.id}` });
  res.json(transition);
});

workflowRouter.delete("/workflow-transitions/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const usedCount = await prisma.workflowCaseEvent.count({ where: { transitionId: req.params.id } });
  if (usedCount > 0) {
    return res.status(409).json({ error: "Tranziția a fost deja folosită în cel puțin un caz și nu poate fi ștearsă" });
  }
  await prisma.workflowTransition.delete({ where: { id: req.params.id } });
  await logAction({ userId: req.user!.id, action: "WORKFLOW_TRANSITION_DELETED", resource: `workflow-transition:${req.params.id}` });
  res.status(204).end();
});

// ------------------------------------------------------------
// Motor de execuție caz — inițiere + avansare (înlocuiește decide/initiate din modelul liniar)
// ------------------------------------------------------------

// Tranzițiile disponibile pentru o cerere: dacă nu are încă un caz, tranzițiile de START
// (fromStateId null) ale fluxurilor active potrivite cu categoria cererii; dacă are deja
// un caz, tranzițiile disponibile din starea curentă a acelui caz.
workflowRouter.get("/requests/:id/workflow/transitions", requireAuth, requireStaff(), async (req, res) => {
  const request = await prisma.dmsRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "Cerere inexistentă" });

  await evaluateAutoTriggers(request.id);

  const workflowCase = await prisma.workflowCase.findUnique({
    where: { requestId: request.id },
    include: { currentState: true, workflowDef: true, events: { orderBy: { createdAt: "asc" }, include: { fromState: true, toState: true, performedBy: { select: { id: true, name: true, email: true } }, transition: { select: { name: true } } } } },
  });

  if (workflowCase) {
    const transitions = await prisma.workflowTransition.findMany({
      where: { workflowDefId: workflowCase.workflowDefId, fromStateId: workflowCase.currentStateId },
      include: fullTransitionInclude,
      orderBy: { order: "asc" },
    });
    return res.json({ case: workflowCase, availableTransitions: transitions });
  }

  const matchingDefs = await prisma.workflowDef.findMany({
    where: { isActive: true, category: request.category },
    include: { transitions: { where: { fromStateId: null }, include: fullTransitionInclude, orderBy: { order: "asc" } } },
  });
  const availableTransitions = matchingDefs.flatMap((d) => d.transitions);
  res.json({ case: null, availableTransitions });
});

const advanceSchema = z.object({
  transitionId: z.string(),
  comment: z.string().optional(),
  checklistConfirmations: z.array(z.string()).default([]),
});

// Inițiere caz (tranziție de START, fromStateId null) — echivalentul fostului
// POST /requests/:id/workflow.
workflowRouter.post("/requests/:id/workflow/initiate", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = advanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const transition = await prisma.workflowTransition.findUnique({ where: { id: parsed.data.transitionId }, include: fullTransitionInclude });
  if (!transition) return res.status(404).json({ error: "Tranziție inexistentă" });
  if (transition.fromStateId !== null) return res.status(400).json({ error: "Această tranziție nu este o tranziție de inițiere (START)" });

  try {
    const workflowCase = await applyTransition({
      transition: transition as any,
      requestId: req.params.id,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      comment: parsed.data.comment,
      checklistConfirmations: parsed.data.checklistConfirmations,
    });
    res.status(201).json(workflowCase);
  } catch (err: any) {
    if (err instanceof TransitionGuardError) return res.status(409).json({ error: err.message });
    if (err.message === "Cerere inexistentă") return res.status(404).json({ error: err.message });
    throw err;
  }
});

// Avansare caz existent — echivalentul fostului POST steps/:stepId/decide, dar generic
// pentru orice tranziție validă din starea curentă (nu doar aprobare/respingere binară).
workflowRouter.post("/requests/:id/workflow/advance", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = advanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const transition = await prisma.workflowTransition.findUnique({ where: { id: parsed.data.transitionId }, include: fullTransitionInclude });
  if (!transition) return res.status(404).json({ error: "Tranziție inexistentă" });

  try {
    const workflowCase = await applyTransition({
      transition: transition as any,
      requestId: req.params.id,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      comment: parsed.data.comment,
      checklistConfirmations: parsed.data.checklistConfirmations,
    });
    res.json(workflowCase);
  } catch (err: any) {
    if (err instanceof TransitionGuardError) return res.status(409).json({ error: err.message });
    if (err.message === "Cerere inexistentă") return res.status(404).json({ error: err.message });
    throw err;
  }
});
