import { Router } from "express";
import multer from "multer";
import path from "path";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { newStoragePath, writeFile, readFile } from "../../shared/storage";
import { chatCompletion, AiMessage } from "../../shared/ai";
import { extractText } from "../../shared/textExtract";
import { generateChatDocumentPdf } from "./pdf";
import { getChatbotSettings } from "./settings.routes";
import { requireAdmin, STAFF_ROLES } from "./rbac";
import { detectSentiment } from "./sentiment";
import { buildRegistryContext } from "./registryContext";
import { buildArchiveContext } from "./archiveContext";

export const chatConversationsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 5 } });

const MAX_HISTORY_MESSAGES = 20;
const MAX_KNOWLEDGE_DOCS = 5;
const MAX_DOC_EXCERPT = 1500;

// Conversații semnalate automat pentru intervenție umană (vezi regula de escaladare pe
// cuvinte-cheie mai jos) — listă la nivelul întregii platforme, nu doar a contului propriu.
chatConversationsRouter.get("/conversations/needs-review", requireAuth, requireAdmin(), async (_req, res) => {
  const conversations = await prisma.chatConversation.findMany({
    where: { needsReview: true },
    include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { messages: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(conversations);
});

chatConversationsRouter.patch("/conversations/:id/resolve-review", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const updated = await prisma.chatConversation.update({ where: { id: req.params.id }, data: { needsReview: false, needsReviewReason: null } });
  await logAction({ userId: req.user!.id, action: "CHAT_REVIEW_RESOLVED", resource: `chatconv:${updated.id}` });
  res.json(updated);
});

// Gestionarea conversațiilor: creare/listă/căutare/redenumire/ștergere (pct. 6).
chatConversationsRouter.get("/conversations", requireAuth, async (req: AuthedRequest, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const conversations = await prisma.chatConversation.findMany({
    where: {
      userId: req.user!.id,
      ...(q
        ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { messages: { some: { content: { contains: q, mode: "insensitive" } } } }] }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  res.json(conversations);
});

chatConversationsRouter.post("/conversations", requireAuth, async (req: AuthedRequest, res) => {
  const title = (req.body?.title as string | undefined)?.trim() || "Conversație nouă";
  const conversation = await prisma.chatConversation.create({ data: { userId: req.user!.id, title } });
  await logAction({ userId: req.user!.id, action: "CHAT_CONVERSATION_CREATED", resource: `chatconv:${conversation.id}` });
  res.status(201).json(conversation);
});

async function loadOwnConversation(conversationId: string, userId: string) {
  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.userId !== userId) return null;
  return conversation;
}

chatConversationsRouter.get("/conversations/:id", requireAuth, async (req: AuthedRequest, res) => {
  const conversation = await loadOwnConversation(req.params.id, req.user!.id);
  if (!conversation) return res.status(404).json({ error: "Conversație inexistentă" });
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    include: { attachments: true },
  });
  res.json({ ...conversation, messages });
});

chatConversationsRouter.patch("/conversations/:id", requireAuth, async (req: AuthedRequest, res) => {
  const conversation = await loadOwnConversation(req.params.id, req.user!.id);
  if (!conversation) return res.status(404).json({ error: "Conversație inexistentă" });
  const title = (req.body?.title as string | undefined)?.trim();
  if (!title) return res.status(400).json({ error: "Titlu invalid" });
  const updated = await prisma.chatConversation.update({ where: { id: conversation.id }, data: { title } });
  res.json(updated);
});

chatConversationsRouter.delete("/conversations/:id", requireAuth, async (req: AuthedRequest, res) => {
  const conversation = await loadOwnConversation(req.params.id, req.user!.id);
  if (!conversation) return res.status(404).json({ error: "Conversație inexistentă" });
  await prisma.chatConversation.delete({ where: { id: conversation.id } });
  await logAction({ userId: req.user!.id, action: "CHAT_CONVERSATION_DELETED", resource: `chatconv:${conversation.id}` });
  res.json({ deleted: true });
});

// Trimitere mesaj (text sau transcris vocal — `inputMethod` vine din client, unde
// Web Speech API a transcris deja înainte de trimitere) + atașamente opționale
// (pct. 7: PDF/PNG/JPG/text, cu extragere de informații pentru cele cu text real).
const inputMethodSchema = z.enum(["TEXT", "VOICE"]);

chatConversationsRouter.post(
  "/conversations/:id/messages",
  requireAuth,
  upload.array("files", 5),
  async (req: AuthedRequest, res) => {
    const conversation = await loadOwnConversation(req.params.id, req.user!.id);
    if (!conversation) return res.status(404).json({ error: "Conversație inexistentă" });

    const content = (req.body?.content as string | undefined)?.trim() || "";
    const inputMethodParsed = inputMethodSchema.safeParse(req.body?.inputMethod || "TEXT");
    const files = (req.files as Express.Multer.File[]) || [];
    if (!content && files.length === 0) return res.status(400).json({ error: "Mesaj gol" });

    const userMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: content || "(fișier atașat)",
        inputMethod: inputMethodParsed.success ? inputMethodParsed.data : "TEXT",
      },
    });

    // Regulă automată: mesajul conține un cuvânt-cheie de escaladare configurat →
    // semnalăm conversația pentru intervenție umană, evaluat aici, la scriere (real-time,
    // nu la citire — nu are sens să aștepți o vizită ulterioară pentru un semnal urgent).
    if (content) {
      const chatbotSettings = await getChatbotSettings();
      const lowerContent = content.toLowerCase();
      const matchedKeyword = chatbotSettings.escalationKeywords.find((k) => lowerContent.includes(k.toLowerCase()));
      if (matchedKeyword) {
        await prisma.chatConversation.update({
          where: { id: conversation.id },
          data: { needsReview: true, needsReviewReason: `Cuvânt-cheie detectat: „${matchedKeyword}”` },
        });
        await logAction({ userId: req.user!.id, action: "CHAT_ESCALATED", resource: `chatconv:${conversation.id}`, metadata: { matchedKeyword } });
      }
    }

    // Identificare stare emoțională (cerință explicită 4.5.11) — apel AI mic, separat de
    // răspunsul principal (rezilient, implicit NEUTRU la eroare, vezi sentiment.ts). Două
    // mesaje consecutive FRUSTRAT/NEGATIV escaladează automat, ca și regula pe cuvinte-cheie.
    if (content) {
      const sentiment = await detectSentiment(content);
      await prisma.chatMessage.update({ where: { id: userMessage.id }, data: { sentiment } });

      if (sentiment === "FRUSTRAT" || sentiment === "NEGATIV") {
        const recentUserMessages = await prisma.chatMessage.findMany({
          where: { conversationId: conversation.id, role: "USER" },
          orderBy: { createdAt: "desc" },
          take: 2,
        });
        const bothNegative =
          recentUserMessages.length === 2 && recentUserMessages.every((m) => m.sentiment === "FRUSTRAT" || m.sentiment === "NEGATIV");
        if (bothNegative) {
          await prisma.chatConversation.update({
            where: { id: conversation.id },
            data: { needsReview: true, needsReviewReason: "Stare emoțională negativă detectată (mesaje consecutive)" },
          });
          await logAction({ userId: req.user!.id, action: "CHAT_ESCALATED", resource: `chatconv:${conversation.id}`, metadata: { reason: "sentiment" } });
        }
      }
    }

    const attachmentExcerpts: string[] = [];
    for (const file of files) {
      const ext = path.extname(file.originalname) || "";
      const storagePath = newStoragePath("chatbot-attachments", ext);
      writeFile(storagePath, file.buffer);
      const extractedText = await extractText(file.mimetype, file.buffer);
      await prisma.chatAttachment.create({
        data: { messageId: userMessage.id, filename: file.originalname, mimeType: file.mimetype, storagePath, extractedText },
      });
      if (extractedText) attachmentExcerpts.push(`[Din fișierul atașat "${file.originalname}"]:\n${extractedText.slice(0, MAX_DOC_EXCERPT)}`);
    }

    // Context AI: istoric recent + excerpte din baza de cunoștințe + din atașamentele mesajului curent.
    const history = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: MAX_HISTORY_MESSAGES,
    });
    const knowledgeDocs = await prisma.chatKnowledgeDocument.findMany({
      where: { extractedText: { not: null } },
      take: MAX_KNOWLEDGE_DOCS,
      orderBy: { createdAt: "desc" },
    });

    const systemParts = [
      "Ești asistentul virtual al platformei Agenției Naționale pentru Sport. Răspunde în limba română, concis, prietenos și util.",
    ];
    // Fundamentare pe date publice reale (cerință 4.5.11) — Registrul Sportiv, Registrul
    // Bazelor Sportive, Anuarul Sportului — nu doar documente încărcate manual de admin.
    const registryContext = await buildRegistryContext();
    if (registryContext) {
      systemParts.push("Date publice reale din platformă (folosește-le ca sursă de adevăr, nu inventa alte cluburi/federații):\n" + registryContext);
    }
    if (knowledgeDocs.length) {
      systemParts.push(
        "Documente disponibile ca sursă de informații:\n" +
          knowledgeDocs.map((d) => `[${d.id}] ${d.filename}:\n${(d.extractedText || "").slice(0, MAX_DOC_EXCERPT)}`).join("\n\n")
      );
    }
    // Fundamentare pe Arhivă (extensie a fundamentării deja existente pe Registru) — doar
    // pentru personal (Arhiva e requireStaff() la nivel de modul propriu — a expune conținut
    // de Arhivă unui cont cetățean prin chatbot ar fi o scurgere de date staff-only către
    // publicul larg, chiar dacă ruta de chat însăși e doar requireAuth()).
    const isStaff = (STAFF_ROLES as readonly string[]).includes(req.user!.role);
    if (isStaff && content) {
      const archiveContext = await buildArchiveContext(content);
      if (archiveContext) {
        systemParts.push("Documente relevante din Arhivă (folosește-le doar dacă răspund direct la întrebare):\n" + archiveContext);
      }
    }
    if (attachmentExcerpts.length) systemParts.push(attachmentExcerpts.join("\n\n"));

    const messages: AiMessage[] = [
      { role: "system", content: systemParts.join("\n\n") },
      ...history.map((m): AiMessage => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content })),
    ];

    let replyText: string;
    try {
      replyText = await chatCompletion(messages);
    } catch (e: any) {
      replyText = `Nu am putut contacta serviciul AI (${e?.message || "eroare necunoscută"}). Verifică cheia GROQ_API_KEY din Secret Manager.`;
    }

    const sourceDocIds = knowledgeDocs.filter((d) => replyText.includes(d.filename)).map((d) => d.id);
    const assistantMessage = await prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: "ASSISTANT", content: replyText, sourceDocIds },
    });

    await prisma.chatConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    await logAction({ userId: req.user!.id, action: "CHAT_MESSAGE_SENT", resource: `chatconv:${conversation.id}` });

    const userMessageWithAttachments = await prisma.chatMessage.findUnique({
      where: { id: userMessage.id },
      include: { attachments: true },
    });
    res.status(201).json({ userMessage: userMessageWithAttachments, assistantMessage });
  }
);

chatConversationsRouter.get("/attachments/:id/file", requireAuth, async (req: AuthedRequest, res) => {
  const attachment = await prisma.chatAttachment.findUnique({ where: { id: req.params.id }, include: { message: { include: { conversation: true } } } });
  if (!attachment) return res.status(404).json({ error: "Atașament inexistent" });
  if (attachment.message.conversation.userId !== req.user!.id) return res.status(403).json({ error: "Acces interzis" });
  const buffer = readFile(attachment.storagePath);
  res.setHeader("Content-Type", attachment.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.filename)}"`);
  res.send(buffer);
});

// Generare document dintr-un șablon — utilizatorul alege explicit șablonul din UI și
// completează valorile cerute (pct. 9); nu se încearcă parsarea automată a chat-ului
// liber pentru variabile, ca să fie predictibil în demo.
const generateDocSchema = z.object({
  templateId: z.string(),
  values: z.record(z.string()),
});

function renderTemplate(body: string, variables: Record<string, unknown>): string {
  return body.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_match, key) => {
    const value = variables[key];
    return value === undefined || value === null ? `{{${key}}}` : String(value);
  });
}

async function loadTemplateAndRender(templateId: string, values: Record<string, string>) {
  const template = await prisma.chatDocumentTemplate.findUnique({ where: { id: templateId } });
  if (!template) return { error: "Șablon inexistent" as const };

  const missing = template.variables.filter((v) => !values[v]?.trim());
  if (missing.length) return { error: `Lipsesc valori pentru: ${missing.join(", ")}` as const };

  return { template, body: renderTemplate(template.body, values) };
}

// Previzualizare (pct. 9) — randează textul final din șablon fără să genereze PDF-ul
// și fără să atingă conversația; utilizatorul confirmă separat înainte de generarea reală.
chatConversationsRouter.post(
  "/conversations/:id/generate-document/preview",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const conversation = await loadOwnConversation(req.params.id, req.user!.id);
    if (!conversation) return res.status(404).json({ error: "Conversație inexistentă" });

    const parsed = generateDocSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const result = await loadTemplateAndRender(parsed.data.templateId, parsed.data.values);
    if ("error" in result) return res.status(result.error === "Șablon inexistent" ? 404 : 400).json({ error: result.error });

    res.json({ title: result.template.name, renderedBody: result.body });
  }
);

chatConversationsRouter.post(
  "/conversations/:id/generate-document",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const conversation = await loadOwnConversation(req.params.id, req.user!.id);
    if (!conversation) return res.status(404).json({ error: "Conversație inexistentă" });

    const parsed = generateDocSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const result = await loadTemplateAndRender(parsed.data.templateId, parsed.data.values);
    if ("error" in result) return res.status(result.error === "Șablon inexistent" ? 404 : 400).json({ error: result.error });
    const { template, body } = result;

    const pdfBuffer = await generateChatDocumentPdf({ title: template.name, body });
    const storagePath = newStoragePath("chatbot-generated", ".pdf");
    writeFile(storagePath, pdfBuffer);

    const assistantMessage = await prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: "ASSISTANT", content: `Am generat documentul „${template.name}". Îl găsești atașat mai jos.` },
    });
    const attachment = await prisma.chatAttachment.create({
      data: {
        messageId: assistantMessage.id,
        filename: `${template.category}-${Date.now()}.pdf`,
        mimeType: "application/pdf",
        storagePath,
      },
    });

    await logAction({ userId: req.user!.id, action: "CHAT_DOCUMENT_GENERATED", resource: `chattemplate:${template.id}` });
    res.status(201).json({ ...assistantMessage, attachments: [attachment] });
  }
);
