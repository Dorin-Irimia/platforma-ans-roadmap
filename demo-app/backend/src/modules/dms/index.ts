import { Router } from "express";
import { ensureStorageDir } from "../../shared/storage";
import { formsRouter } from "./forms.routes";
import { registryRouter } from "./registry.routes";
import { workflowRouter } from "./workflow.routes";
import { commentsRouter } from "./comments.routes";
import { responsesRouter } from "./responses.routes";
import { documentsRouter } from "./documents.routes";
import { archiveRouter } from "./archive.routes";
import { registriesRouter } from "./registries.routes";

ensureStorageDir();

export const dmsRouter = Router();

dmsRouter.use(formsRouter);
dmsRouter.use(registryRouter);
dmsRouter.use(workflowRouter);
dmsRouter.use(commentsRouter);
dmsRouter.use(responsesRouter);
dmsRouter.use(documentsRouter);
dmsRouter.use(archiveRouter);
dmsRouter.use(registriesRouter);
