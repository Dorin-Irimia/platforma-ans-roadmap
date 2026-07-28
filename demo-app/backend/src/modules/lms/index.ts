import { Router } from "express";
import { lmsCoursesRouter } from "./courses.routes";
import { lmsLessonsRouter } from "./lessons.routes";
import { lmsAiRouter } from "./ai.routes";
import { lmsCollaborationRouter } from "./collaboration.routes";
import { lmsEnrollmentRouter } from "./enrollment.routes";
import { lmsQuizRouter } from "./quiz.routes";
import { lmsAssistantRouter } from "./assistant.routes";
import { lmsTtsRouter } from "./tts.routes";
import { lmsMediaRouter } from "./media.routes";
import { lmsProjectsRouter } from "./projects.routes";

export const lmsRouter = Router();

lmsRouter.use(lmsProjectsRouter);
lmsRouter.use(lmsCoursesRouter);
lmsRouter.use(lmsLessonsRouter);
lmsRouter.use(lmsAiRouter);
lmsRouter.use(lmsCollaborationRouter);
lmsRouter.use(lmsEnrollmentRouter);
lmsRouter.use(lmsQuizRouter);
lmsRouter.use(lmsAssistantRouter);
lmsRouter.use(lmsTtsRouter);
lmsRouter.use(lmsMediaRouter);
