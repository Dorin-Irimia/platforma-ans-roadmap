import { Router } from "express";
import { portalMeRouter } from "./me.routes";
import { mediaRouter } from "./media.routes";
import { cmsRouter } from "./cms.routes";
import { emailTemplatesRouter } from "./email-templates.routes";

export const portalRouter = Router();
portalRouter.use(portalMeRouter);
portalRouter.use(mediaRouter);
portalRouter.use(cmsRouter);
portalRouter.use(emailTemplatesRouter);
