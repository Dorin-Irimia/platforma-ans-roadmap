import { Router } from "express";
import { yearbookRouter } from "./yearbook.routes";

export const yearbookModuleRouter = Router();

yearbookModuleRouter.use(yearbookRouter);
