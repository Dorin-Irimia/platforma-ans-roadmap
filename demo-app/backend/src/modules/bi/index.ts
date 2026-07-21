import { Router } from "express";
import { biRouter as biRoutes } from "./bi.routes";

export const biRouter = Router();
biRouter.use(biRoutes);
