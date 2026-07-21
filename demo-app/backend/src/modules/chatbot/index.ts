import { Router } from "express";
import { ensureStorageDir } from "../../shared/storage";
import { chatDocumentsRouter } from "./documents.routes";
import { chatTemplatesRouter } from "./templates.routes";
import { chatConversationsRouter } from "./conversations.routes";
import { chatbotSettingsRouter } from "./settings.routes";
import { chatVariablesRouter } from "./variables.routes";

ensureStorageDir();

export const chatbotRouter = Router();

chatbotRouter.use(chatDocumentsRouter);
chatbotRouter.use(chatTemplatesRouter);
chatbotRouter.use(chatConversationsRouter);
chatbotRouter.use(chatbotSettingsRouter);
chatbotRouter.use(chatVariablesRouter);
