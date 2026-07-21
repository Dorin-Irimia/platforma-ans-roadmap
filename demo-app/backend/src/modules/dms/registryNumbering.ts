import { prisma } from "../../shared/prisma";
import { RegistryNumberKind } from "@prisma/client";

// Emite următorul număr dintr-un registru configurat — contorul e ținut per an
// calendaristic (RegistryYearCounter), ca să se reseteze automat la 1 ianuarie.
// Primul număr emis într-un an nou pornește de la `startNumber` al registrului
// (asta permite unui registru nou creat să "continue" de la orice cifră aleasă,
// ex. dacă preia un registru fizic ajuns deja la 500). Formatul include codul
// registrului ca prefix ("COD-N/AN") — cu excepția registrelor cu cod gol (""),
// rezervat registrelor implicite istorice, ca formatul lor "N/AN" să rămână neschimbat.
export async function issueRegistryNumber(registryId: string): Promise<{ number: string; date: Date }> {
  const registry = await prisma.numberingRegistry.findUniqueOrThrow({ where: { id: registryId } });
  const date = new Date();
  const year = date.getFullYear();

  let lastNumber: number;
  const existingForYear = await prisma.registryYearCounter.findUnique({ where: { registryId_year: { registryId, year } } });
  if (existingForYear) {
    // Increment atomic direct în SQL — evită fereastra de race a unui citește-apoi-scrie.
    const counter = await prisma.registryYearCounter.update({
      where: { registryId_year: { registryId, year } },
      data: { lastNumber: { increment: 1 } },
    });
    lastNumber = counter.lastNumber;
  } else {
    // Primul număr emis în acest an pentru acest registru: dacă registrul n-a mai emis
    // niciodată (niciun an anterior), pornim de la `startNumber` configurat (permite unui
    // registru nou să continue de la orice cifră, ex. un registru fizic ajuns deja la 500).
    // Dacă a mai avut ani anteriori, seria reîncepe de la 1 — convenția standard de
    // registratură (numerotarea se resetează la 1 ianuarie), nu repetă startNumber la infinit.
    const hasPriorYear = await prisma.registryYearCounter.findFirst({ where: { registryId } });
    lastNumber = hasPriorYear ? 1 : registry.startNumber;
    await prisma.registryYearCounter.create({ data: { registryId, year, lastNumber } });
  }

  const number = registry.code ? `${registry.code}-${lastNumber}/${year}` : `${lastNumber}/${year}`;
  return { number, date };
}

export async function getDefaultRegistry(kind: RegistryNumberKind) {
  const registry = await prisma.numberingRegistry.findFirst({ where: { kind, isDefault: true }, orderBy: { createdAt: "asc" } });
  if (!registry) throw new Error(`Niciun registru implicit configurat pentru seria ${kind}`);
  return registry;
}
