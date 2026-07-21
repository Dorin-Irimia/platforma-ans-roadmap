import { Router } from "express";
import { dashboardRouter as widgetsRouter } from "./routes";

export const dashboardRouter = Router();
dashboardRouter.use(widgetsRouter);
