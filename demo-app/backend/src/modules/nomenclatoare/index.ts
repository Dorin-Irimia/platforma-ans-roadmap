import { Router } from "express";
import { nomenclatoareRouter } from "./nomenclatoare.routes";

export const nomenclatoareModuleRouter = Router();

nomenclatoareModuleRouter.use(nomenclatoareRouter);
