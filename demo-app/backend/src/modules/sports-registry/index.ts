import { Router } from "express";
import { federationsRouter } from "./federations.routes";
import { clubsRouter } from "./clubs.routes";
import { athletesRouter } from "./athletes.routes";
import { coachesRouter } from "./coaches.routes";
import { facilitiesRouter } from "./facilities.routes";
import { cisRouter } from "./cis.routes";

export const sportsRegistryRouter = Router();

sportsRegistryRouter.use(federationsRouter);
sportsRegistryRouter.use(clubsRouter);
sportsRegistryRouter.use(athletesRouter);
sportsRegistryRouter.use(coachesRouter);
sportsRegistryRouter.use(facilitiesRouter);
sportsRegistryRouter.use(cisRouter);
