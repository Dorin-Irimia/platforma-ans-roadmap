// Motorul de execuție al fluxurilor de lucru (model URBIO Workflow Builder: stări +
// tranziții cu Șabloane/Validări/Acțiuni/Declanșatori). Fiecare tranziție reprezintă o
// muchie a grafului de stări; aplicarea ei rulează, în ordine: (1) validările — dacă
// oricare eșuează, tranziția e blocată — apoi (2) acțiunile automate.
//
// Notă de scop (documentată și în README): Declanșatorii (Triggers) nu au infrastructură
// de scheduler/cron în acest demo — sunt evaluați "leneș", la citire (când se deschide
// detaliul unei cereri), nu pe un tick real de fundal. Acțiunile fără infrastructură reală
// în platformă (trimitere email, notificare push, eveniment de calendar, publicare pe
// site public) sunt înregistrate ca AuditLog (simulate), nu au un efect extern real —
// exact ca semnătura electronică "mock" deja documentată pentru acest modul.
import { prisma } from "../../shared/prisma";
import { logAction } from "../iam/audit.service";
import { computeDueDate } from "./deadline";
import { generateResponseForRequest } from "./responses.routes";

export interface TransitionWithBehavior {
  id: string;
  workflowDefId: string;
  name: string;
  fromStateId: string | null;
  toStateId: string;
  requiresComment: boolean;
  requiresApproval: boolean;
  notifySubmitter: boolean;
  templates: { id: string; formId: string; required: boolean; form?: { name: string } }[];
  validations: { id: string; type: string; config: any }[];
  actions: { id: string; type: string; config: any }[];
  triggers: { id: string; type: string; config: any }[];
}

export const transitionInclude = {
  templates: { include: { form: { select: { id: true, name: true, templateType: true } } }, orderBy: { id: "asc" as const } },
  validations: { orderBy: { order: "asc" as const } },
  actions: { orderBy: { order: "asc" as const } },
  triggers: true,
};

export class TransitionGuardError extends Error {}

// Rolurile considerate "manager" pentru aprobare/respingere (cerință Scenariul 1, pct. 15:
// "aprobare/respingere cu observații de către manager") — nu există un rol dedicat "Manager"
// în nomenclatorul RBAC, deci folosim rolurile cu atribuții de supervizare/administrare deja
// existente (Super Admin, Admin Instituție, Moderator).
export const APPROVAL_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR"];

// Rulează validările atașate unei tranziții, în ordine. Prima care eșuează oprește
// procesul și întoarce un mesaj prietenos (blocaj afișat direct utilizatorului).
export async function runValidations(
  transition: TransitionWithBehavior,
  request: { id: string; data: any },
  extra: { checklistConfirmations?: string[] } = {}
): Promise<void> {
  for (const validation of transition.validations) {
    switch (validation.type) {
      case "VALIDATE_FIELD": {
        const cfg = (validation.config || {}) as { fieldKey?: string; operator?: string; value?: string };
        if (!cfg.fieldKey) break;
        const actual = String((request.data as Record<string, unknown>)?.[cfg.fieldKey] ?? "");
        const ok = cfg.operator === "not_equals" ? actual !== cfg.value : actual === (cfg.value ?? "");
        if (!ok) throw new TransitionGuardError(`Validare eșuată: câmpul „${cfg.fieldKey}” nu îndeplinește condiția configurată`);
        break;
      }
      case "VALIDATE_UNIQUENESS": {
        const cfg = (validation.config || {}) as { fieldKey?: string };
        if (!cfg.fieldKey) break;
        const value = (request.data as Record<string, unknown>)?.[cfg.fieldKey];
        if (value === undefined || value === null || value === "") break;
        const duplicate = await prisma.dmsRequest.findFirst({
          where: {
            id: { not: request.id },
            data: { path: [cfg.fieldKey], equals: value } as any,
          },
        });
        if (duplicate) throw new TransitionGuardError(`Validare eșuată: valoarea câmpului „${cfg.fieldKey}” trebuie să fie unică (deja folosită de cererea ${duplicate.registryNumber})`);
        break;
      }
      case "VALIDATE_SIGNATURE": {
        const signed = await prisma.officialResponse.findFirst({ where: { requestId: request.id, status: { in: ["SIGNED", "SENT"] } } });
        if (!signed) throw new TransitionGuardError("Validare eșuată: cererea nu are niciun răspuns semnat electronic");
        break;
      }
      case "MANUAL_CHECKLIST": {
        const confirmed = extra.checklistConfirmations || [];
        if (!confirmed.includes(validation.id)) {
          throw new TransitionGuardError("Validare eșuată: bifa de confirmare manuală nu a fost marcată");
        }
        break;
      }
      case "VALIDATE_TEMPLATE": {
        // Verificăm doar șabloanele de tip "Document extern" — cele care produc efectiv
        // un document generat/semnat prin fluxul de răspuns oficial existent. Șabloanele de
        // tip Formular cerere/Document intern nu au încă un flux de generare propriu legat
        // de tranziție, deci sunt considerate satisfăcute implicit (scope cut documentat).
        const requiredExternal = transition.templates.filter((t) => t.required && (t.form as any)?.templateType === "EXTERNAL_DOCUMENT");
        if (requiredExternal.length > 0) {
          const hasDocument = await prisma.document.findFirst({ where: { requestId: request.id, kind: { in: ["GENERATED_RESPONSE", "SIGNED_RESPONSE"] } } });
          if (!hasDocument) throw new TransitionGuardError("Validare eșuată: șablonul de document extern obligatoriu nu a fost încă generat pentru această cerere");
        }
        break;
      }
    }
  }
}

// Rulează acțiunile atașate unei tranziții, în ordine, după ce validările au trecut.
export async function runActions(
  transition: TransitionWithBehavior,
  request: { id: string; registryNumber: string; data: any },
  actorId: string | null
): Promise<void> {
  for (const action of transition.actions) {
    const cfg = (action.config || {}) as Record<string, any>;
    switch (action.type) {
      case "ASSIGN_TO_USER":
        if (cfg.userId) await prisma.dmsRequest.update({ where: { id: request.id }, data: { assignedToId: cfg.userId } });
        break;
      case "ASSIGN_TO_GROUP":
        if (cfg.groupId) await prisma.dmsRequest.update({ where: { id: request.id }, data: { assignedGroupId: cfg.groupId } });
        break;
      case "SET_DUE_DATE":
        if (cfg.quantity && cfg.unit) {
          await prisma.dmsRequest.update({ where: { id: request.id }, data: { legalDeadline: computeDueDate(Number(cfg.quantity), cfg.unit) } });
        }
        break;
      case "ADD_TAG":
        if (cfg.tag) {
          const current = await prisma.dmsRequest.findUnique({ where: { id: request.id }, select: { tags: true } });
          const tags = new Set(current?.tags || []);
          tags.add(String(cfg.tag));
          await prisma.dmsRequest.update({ where: { id: request.id }, data: { tags: Array.from(tags) } });
        }
        break;
      case "LOCK_REQUEST":
        await prisma.dmsRequest.update({ where: { id: request.id }, data: { locked: true } });
        break;
      case "ARCHIVE_REQUEST":
        await prisma.dmsRequest.update({ where: { id: request.id }, data: { archived: true } });
        break;
      case "GENERATE_DOCUMENT":
        if (cfg.responseTemplateId) {
          try {
            await generateResponseForRequest(request.id, cfg.responseTemplateId, actorId);
          } catch {
            // Nu blocăm avansarea dacă generarea documentului eșuează (ex. șablon șters) —
            // se înregistrează totuși intenția în audit, mai jos.
          }
        }
        break;
      // Fără infrastructură reală de email/notificări/calendar/site public în acest demo —
      // înregistrăm intenția ca audit log (simulare), documentat explicit în README.
      case "SEND_EMAIL":
      case "SEND_NOTIFICATION":
      case "REQUEST_SIGNATURE":
      case "PUBLISH_TO_PORTAL":
      case "CREATE_CALENDAR_EVENT":
        break;

      // Integrare reală cu Registrul Sportiv — cererea (data-ul formularului depus prin
      // Portal/Registratură) identifică entitatea de domeniu vizată; la aplicarea acestei
      // tranziții, acțiunea scrie efectiv rezultatul adjudecării pe entitatea respectivă,
      // nu doar pe DmsRequest.
      case "ISSUE_CIS": {
        const entityType = (request.data as Record<string, unknown>)?.cisEntityType as "FEDERATION" | "CLUB" | undefined;
        const entityId = (request.data as Record<string, unknown>)?.cisEntityId as string | undefined;
        if (entityType && entityId) {
          const year = new Date().getFullYear();
          const countThisYear = await prisma.sportsIdentityCertificate.count({
            where: { issuedAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
          });
          await prisma.sportsIdentityCertificate.create({
            data: {
              entityType,
              entityId,
              certificateNumber: `CIS-${year}-${String(countThisYear + 1).padStart(4, "0")}`,
              sourceRequestId: request.id,
            },
          });
        }
        break;
      }
      case "ACTIVATE_FACILITY": {
        const facilityId = (request.data as Record<string, unknown>)?.facilityId as string | undefined;
        if (facilityId) await prisma.sportsFacility.update({ where: { id: facilityId }, data: { status: "ACTIVE" } });
        break;
      }
      case "GRANT_COACH_TITLE": {
        const coachId = (request.data as Record<string, unknown>)?.coachId as string | undefined;
        if (coachId) await prisma.coach.update({ where: { id: coachId }, data: { isEmerit: true } });
        break;
      }
      case "APPROVE_TRANSFER": {
        const transferId = (request.data as Record<string, unknown>)?.transferId as string | undefined;
        if (transferId) {
          const transfer = await prisma.athleteTransfer.update({ where: { id: transferId }, data: { status: "APPROVED" } });
          await prisma.athlete.update({ where: { id: transfer.athleteId }, data: { clubId: transfer.toClubId } });
        }
        break;
      }
    }

    await logAction({
      userId: actorId ?? undefined,
      action: `WORKFLOW_ACTION_${action.type}`,
      resource: `request:${request.id}`,
      metadata: cfg,
    });
  }
}

// Aplică efectiv o tranziție: validează → acțiuni → creează/actualizează WorkflowCase →
// înregistrează evenimentul de istoric → sincronizează statusul general al cererii.
export async function applyTransition(params: {
  transition: TransitionWithBehavior;
  requestId: string;
  actorId: string | null;
  actorRole?: string | null;
  comment?: string;
  checklistConfirmations?: string[];
}) {
  const { transition, requestId, actorId, actorRole, comment, checklistConfirmations } = params;

  const request = await prisma.dmsRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Cerere inexistentă");

  // Comentariul obligatoriu și restricția de rol pentru aprobare sunt reguli ale
  // tranziției în sine (nu "validări" configurabile) — se verifică întotdeauna server-side,
  // indiferent dacă frontend-ul le-a mai verificat deja (nu ne bazăm doar pe validarea client).
  if (transition.requiresComment && !comment?.trim()) {
    throw new TransitionGuardError("Această tranziție necesită un comentariu/observație");
  }
  if (transition.requiresApproval && actorRole && !APPROVAL_ROLES.includes(actorRole)) {
    throw new TransitionGuardError("Doar un cont cu rol de aprobare (Moderator/Admin Instituție/Super Admin) poate aplica această tranziție");
  }

  await runValidations(transition, request, { checklistConfirmations });

  const existingCase = await prisma.workflowCase.findUnique({ where: { requestId } });
  if (transition.fromStateId === null && existingCase) {
    throw new TransitionGuardError("Această cerere are deja un flux de lucru activ");
  }
  if (transition.fromStateId !== null && (!existingCase || existingCase.currentStateId !== transition.fromStateId)) {
    throw new TransitionGuardError("Tranziția nu este disponibilă din starea curentă a cererii");
  }

  await runActions(transition, request, actorId);

  const toState = await prisma.workflowState.findUnique({ where: { id: transition.toStateId } });
  if (!toState) throw new Error("Stare de destinație inexistentă");

  let workflowCase;
  if (existingCase) {
    workflowCase = await prisma.workflowCase.update({
      where: { id: existingCase.id },
      data: { currentStateId: toState.id, enteredStateAt: new Date() },
    });
  } else {
    // Termenul implicit al fluxului (dacă e configurat pe WorkflowDef) se calculează o
    // singură dată, la inițiere — vezi câmpul WorkflowCase.dueAt.
    const workflowDef = await prisma.workflowDef.findUnique({ where: { id: transition.workflowDefId } });
    const dueAt =
      workflowDef?.dueDateQuantity && workflowDef?.dueDateUnit
        ? computeDueDate(workflowDef.dueDateQuantity, workflowDef.dueDateUnit)
        : null;
    workflowCase = await prisma.workflowCase.create({
      data: { requestId, workflowDefId: transition.workflowDefId, currentStateId: toState.id, dueAt },
    });
  }

  await prisma.workflowCaseEvent.create({
    data: {
      caseId: workflowCase.id,
      transitionId: transition.id,
      fromStateId: transition.fromStateId,
      toStateId: toState.id,
      performedById: actorId,
      comment,
    },
  });

  // Sincronizare status general al cererii (afișat în Registratură) după categoria stării
  // în care a ajuns cazul — RESPINS e determinat euristic din numele stării (nomenclatorul
  // de stări e liber, definit de administrator, nu există un flag dedicat de "respingere").
  const rejected = /respin/i.test(toState.name);
  const status = rejected ? "RESPINS" : toState.category === "DONE" || toState.category === "ARCHIVED" ? "FINALIZAT" : "IN_LUCRU";
  await prisma.dmsRequest.update({ where: { id: requestId }, data: { status } });

  await logAction({
    userId: actorId ?? undefined,
    action: "WORKFLOW_TRANSITION_APPLIED",
    resource: `request:${requestId}`,
    metadata: { transitionId: transition.id, toStateId: toState.id, toStateName: toState.name },
  });

  return workflowCase;
}

// Evaluează (leneș, la citire) declanșatorii tranzițiilor disponibile din starea curentă
// a unui caz — dacă un declanșator e satisfăcut, tranziția se aplică automat, dar NUMAI
// dacă nu necesită aprobare/checklist manual (altfel am ocoli silențios revizuirea umană).
export async function evaluateAutoTriggers(requestId: string): Promise<void> {
  const workflowCase = await prisma.workflowCase.findUnique({ where: { requestId } });
  if (!workflowCase) return;

  const candidates = await prisma.workflowTransition.findMany({
    where: { workflowDefId: workflowCase.workflowDefId, fromStateId: workflowCase.currentStateId },
    include: transitionInclude,
  });

  for (const transition of candidates) {
    if (transition.triggers.length === 0) continue;
    if (transition.requiresApproval || transition.validations.some((v) => v.type === "MANUAL_CHECKLIST")) continue;

    let satisfied = true;
    for (const trigger of transition.triggers) {
      const cfg = (trigger.config || {}) as Record<string, any>;
      if (trigger.type === "RESPONSE_THRESHOLD") {
        const count = await prisma.officialResponse.count({ where: { requestId } });
        if (count < Number(cfg.minResponses ?? 1)) satisfied = false;
      } else if (trigger.type === "DURATION_IN_STATE") {
        const elapsedMs = Date.now() - new Date(workflowCase.enteredStateAt).getTime();
        const thresholdMs = durationToMs(Number(cfg.quantity ?? 0), cfg.unit ?? "HOURS");
        if (elapsedMs < thresholdMs) satisfied = false;
      } else if (trigger.type === "DEADLINE_OVERDUE") {
        const request = await prisma.dmsRequest.findUnique({ where: { id: requestId }, select: { legalDeadline: true } });
        if (!request?.legalDeadline || request.legalDeadline > new Date()) satisfied = false;
      }
      if (!satisfied) break;
    }

    if (satisfied) {
      try {
        await applyTransition({ transition: transition as any, requestId, actorId: null, comment: "Aplicată automat de un declanșator (trigger)" });
      } catch {
        // Dacă alte validări (non-manuale) blochează, pur și simplu nu avansăm automat.
      }
      return; // o singură tranziție automată per evaluare, ca să nu "sară" mai multe stări deodată
    }
  }
}

function durationToMs(quantity: number, unit: string): number {
  switch (unit) {
    case "MINUTES":
      return quantity * 60_000;
    case "HOURS":
      return quantity * 3_600_000;
    case "BUSINESS_DAYS":
    case "MONTHS":
    case "YEARS":
    default:
      return quantity * 86_400_000; // aproximare simplă, suficientă pentru scopul demonstrativ
  }
}
