import { Router } from "express";
import { ensureStorageDir } from "../../shared/storage";
import { artifactsRouter } from "./artifacts.routes";
import { visitsRouter } from "./visits.routes";

ensureStorageDir();

export const museumRouter = Router();

museumRouter.use(artifactsRouter);
museumRouter.use(visitsRouter);
