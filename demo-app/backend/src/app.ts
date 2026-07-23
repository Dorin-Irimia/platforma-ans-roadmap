// Trebuie importat înaintea oricăror rute — patch-uiește Express 4 să prindă
// automat erorile aruncate în handlere async (fără asta, o eroare la o interogare
// Prisma într-un handler `async` NU ajunge la middleware-ul de erori, ci devine
// un unhandled promise rejection care poate opri procesul Node în tăcere).
import "express-async-errors";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { iamRouter, groupsRouter, roeidRouter } from "./modules/iam";
import { dmsRouter } from "./modules/dms";
import { biRouter } from "./modules/bi";
import { dashboardRouter } from "./modules/dashboard";
import { chatbotRouter } from "./modules/chatbot";
import { lmsRouter } from "./modules/lms";
import { sportsRegistryRouter } from "./modules/sports-registry";
import { museumRouter } from "./modules/museum";
import { yearbookModuleRouter } from "./modules/yearbook";
import { nomenclatoareModuleRouter } from "./modules/nomenclatoare";
import { portalRouter } from "./modules/portal";
import { requestContextMiddleware } from "./shared/requestContext";
import { prisma } from "./shared/prisma";

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(requestContextMiddleware);

app.get("/health", async (_req, res) => {
  let database: "ok" | "unreachable" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unreachable";
  }
  res.json({ status: "ok", database, scenarios: ["iam", "dms", "bi", "chatbot", "lms", "sports-registry", "museum"] });
});

app.use("/api/iam", iamRouter);
app.use("/api/iam", groupsRouter);
app.use("/api/iam", roeidRouter);
app.use("/api/dms", dmsRouter);
app.use("/api/bi", biRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/chatbot", chatbotRouter);
app.use("/api/lms", lmsRouter);
app.use("/api/sports-registry", sportsRegistryRouter);
app.use("/api/museum", museumRouter);
app.use("/api/yearbook", yearbookModuleRouter);
// Sub /api/dms — rutele de legare la formular (/forms/:formId/nomenclator-links) trebuie
// să coexiste cu restul rutelor de formulare deja montate acolo (dms/forms.routes.ts).
app.use("/api/dms", nomenclatoareModuleRouter);
app.use("/api/portal", portalRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Rută inexistentă: ${req.method} ${req.path}` });
});

// Handler global de erori — orice excepție (Prisma, JWT, validare scăpată etc.)
// se întoarce ca JSON coerent în loc de o pagină HTML sau o conexiune căzută.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled-error]", err);
  const code = err?.code as string | undefined;
  if (code === "P2021" || code === "P2010") {
    return res.status(503).json({
      error: "Baza de date nu este pregătită încă (schema lipsă). Reîncearcă în câteva secunde.",
    });
  }
  if (code?.startsWith?.("P")) {
    return res.status(400).json({ error: "Eroare de bază de date", detail: err.message });
  }
  res.status(500).json({ error: "Eroare internă de server", detail: err?.message ?? String(err) });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`ANS demo backend ascultă pe portul ${port}`));

process.on("unhandledRejection", (reason) => {
  console.error("[unhandled-rejection]", reason);
});
