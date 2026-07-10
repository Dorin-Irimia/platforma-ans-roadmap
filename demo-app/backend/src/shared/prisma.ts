import { PrismaClient } from "@prisma/client";

// Singleton — evită deschiderea a multiple conexiuni în dev (hot-reload).
export const prisma = new PrismaClient();
