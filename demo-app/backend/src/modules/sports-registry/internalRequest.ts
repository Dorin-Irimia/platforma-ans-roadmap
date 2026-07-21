import { prisma } from "../../shared/prisma";
import { issueRegistryNumber, getDefaultRegistry } from "../dms/registryNumbering";

// Creează o "Cerere" internă (fără Formular/Portal, `formId: null`) care intră direct
// în Registratură și poate fi procesată prin motorul de Workflow existent — exact
// integrarea reală cerută: emiterea CIS/aprobarea unui transfer/omologarea unei baze
// sportive/titlul de antrenor emerit sunt cereri reale, vizibile în Registratură,
// nu proceduri paralele. `submitterName`/`submitterEmail` identifică inițiatorul intern.
export async function createInternalRequest(input: {
  category: string;
  submitterName: string;
  submitterEmail: string;
  data: Record<string, unknown>;
}) {
  const internRegistry = await getDefaultRegistry("INTERN");
  const { number: registryNumber } = await issueRegistryNumber(internRegistry.id);

  return prisma.dmsRequest.create({
    data: {
      registryNumber,
      numberKind: "INTERN",
      registryId: internRegistry.id,
      formId: null,
      submitterName: input.submitterName,
      submitterEmail: input.submitterEmail,
      data: input.data as any,
      category: input.category,
      domain: "registru-sportiv",
    },
  });
}
