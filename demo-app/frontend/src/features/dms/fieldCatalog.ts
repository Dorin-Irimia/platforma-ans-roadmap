// Catalog de tipuri de câmpuri pentru editorul de șabloane — oglindește enum-ul
// Prisma `FieldType` din backend/prisma/schema.prisma. Grupate pe 6 categorii,
// după modelul editorului de șabloane URBIO.

export type FieldCategoryKey = "SYSTEM" | "GENERAL" | "TIME" | "LOCATION" | "OPTIONS" | "LAYOUT";

export type FieldType =
  // Sistem
  | "ACCOUNT"
  | "REGISTRATION"
  | "REPEATABLE_GROUP"
  | "NOTIFICATION_TEMPLATE"
  | "NOTIFICATION_RECIPIENTS"
  | "DYNAMIC_FORM_BUILDER"
  | "DYNAMIC_FORM_RENDER"
  | "ACCESS_DEFINITION"
  // General
  | "SHORT_TEXT"
  | "SHORT_NUMBER"
  | "LONG_TEXT"
  | "EMAIL"
  | "FILE_UPLOAD_AI"
  | "CARD_EXTRACT_AI"
  | "FILE_UPLOAD"
  // Timp
  | "DATE"
  | "DATETIME"
  | "TIME"
  | "SCHEDULE"
  // Locație
  | "MAP_POINT"
  | "REGION"
  // Opțiuni
  | "DROPDOWN"
  | "CHECKBOX"
  | "RADIO"
  | "NESTED_CHECKBOXES"
  | "MULTI_CHECKBOX"
  | "SURVEY"
  | "TOGGLE"
  | "STAR_RATING"
  | "SCALE"
  // Aspect
  | "STATIC_TEXT"
  | "LINK"
  | "MEDIA";

export const CATEGORY_LABELS: Record<FieldCategoryKey, string> = {
  SYSTEM: "Sistem",
  GENERAL: "General",
  TIME: "Timp",
  LOCATION: "Locație",
  OPTIONS: "Opțiuni",
  LAYOUT: "Aspect",
};

export interface FieldCatalogEntry {
  category: FieldCategoryKey;
  label: string;
  hint?: string;
  defaultConfig?: Record<string, unknown>;
  hasOptions?: boolean; // afișează editor de listă opțiuni în panoul de setări
  hasLengthLimits?: boolean; // minLength/maxLength
  hasValueLimits?: boolean; // minValue/maxValue
  supportsAiAutofill?: boolean;
}

export const FIELD_CATALOG: Record<FieldType, FieldCatalogEntry> = {
  // ——— Sistem ———
  ACCOUNT: { category: "SYSTEM", label: "Cont", hint: "Date din contul autentificat al solicitantului" },
  REGISTRATION: {
    category: "SYSTEM",
    label: "Înregistrare",
    hint: "Registru + tip intrare/ieșire + mod de numerotare",
    defaultConfig: { registryCategory: "", entryExitType: "INTRARE", numberingMode: "NEXT_IN_LIST" },
  },
  REPEATABLE_GROUP: { category: "SYSTEM", label: "Grup repetabil", hint: "Set de câmpuri ce se pot repeta (ex: mai mulți membri)" },
  NOTIFICATION_TEMPLATE: { category: "SYSTEM", label: "Șablon notificare", defaultConfig: { message: "" } },
  NOTIFICATION_RECIPIENTS: { category: "SYSTEM", label: "Listă destinatari notificare", defaultConfig: { recipients: [] } },
  DYNAMIC_FORM_BUILDER: { category: "SYSTEM", label: "Creator de formulare dinamice" },
  DYNAMIC_FORM_RENDER: { category: "SYSTEM", label: "Redare formular dinamic" },
  ACCESS_DEFINITION: {
    category: "SYSTEM",
    label: "Definiție acces",
    hint: "Reguli de acces separate pentru instanță și pentru tranziție",
    defaultConfig: { instanceRoles: [], transitionRoles: [] },
  },

  // ——— General ———
  SHORT_TEXT: { category: "GENERAL", label: "Răspuns scurt (text)", hasLengthLimits: true, supportsAiAutofill: true },
  SHORT_NUMBER: { category: "GENERAL", label: "Răspuns scurt (număr)", hasValueLimits: true, supportsAiAutofill: true },
  LONG_TEXT: { category: "GENERAL", label: "Răspuns lung", hasLengthLimits: true, supportsAiAutofill: true },
  EMAIL: { category: "GENERAL", label: "Adresă email", supportsAiAutofill: true },
  FILE_UPLOAD_AI: { category: "GENERAL", label: "Încărcare fișier + extragere AI", hint: "Extrage automat date din documentul scanat" },
  CARD_EXTRACT_AI: { category: "GENERAL", label: "Card extras cu AI", hint: "Extrage date de contact dintr-o carte de vizită/act" },
  FILE_UPLOAD: { category: "GENERAL", label: "Încărcare fișiere" },

  // ——— Timp ———
  DATE: { category: "TIME", label: "Dată" },
  DATETIME: { category: "TIME", label: "Dată și oră" },
  TIME: { category: "TIME", label: "Timp" },
  SCHEDULE: { category: "TIME", label: "Selector de orar" },

  // ——— Locație ———
  MAP_POINT: { category: "LOCATION", label: "Punct pe hartă" },
  REGION: { category: "LOCATION", label: "Regiune", hasOptions: true },

  // ——— Opțiuni ———
  DROPDOWN: { category: "OPTIONS", label: "Listă derulantă", hasOptions: true },
  CHECKBOX: { category: "OPTIONS", label: "Casetă de selectare" },
  RADIO: { category: "OPTIONS", label: "Butoane radio", hasOptions: true },
  NESTED_CHECKBOXES: { category: "OPTIONS", label: "Bifări imbricate", hasOptions: true },
  MULTI_CHECKBOX: { category: "OPTIONS", label: "Bifări multiple", hasOptions: true },
  SURVEY: { category: "OPTIONS", label: "Sondaj", hasOptions: true },
  TOGGLE: { category: "OPTIONS", label: "Comutator" },
  STAR_RATING: { category: "OPTIONS", label: "Evaluare cu stele", defaultConfig: { maxStars: 5 } },
  SCALE: { category: "OPTIONS", label: "Scară", defaultConfig: { min: 1, max: 10 } },

  // ——— Aspect ———
  STATIC_TEXT: { category: "LAYOUT", label: "Text static", defaultConfig: { text: "" } },
  LINK: { category: "LAYOUT", label: "Legătură", defaultConfig: { url: "", linkLabel: "" } },
  MEDIA: { category: "LAYOUT", label: "Media", defaultConfig: { mediaUrl: "" } },
};

export const CATEGORY_ORDER: FieldCategoryKey[] = ["SYSTEM", "GENERAL", "TIME", "LOCATION", "OPTIONS", "LAYOUT"];

export function fieldsByCategory(): Record<FieldCategoryKey, { type: FieldType; entry: FieldCatalogEntry }[]> {
  const result: Record<FieldCategoryKey, { type: FieldType; entry: FieldCatalogEntry }[]> = {
    SYSTEM: [],
    GENERAL: [],
    TIME: [],
    LOCATION: [],
    OPTIONS: [],
    LAYOUT: [],
  };
  (Object.keys(FIELD_CATALOG) as FieldType[]).forEach((type) => {
    const entry = FIELD_CATALOG[type];
    result[entry.category].push({ type, entry });
  });
  return result;
}

export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  REQUEST_FORM: "Formular cerere",
  INTERNAL_DOCUMENT: "Document intern",
  EXTERNAL_DOCUMENT: "Document extern",
};

export interface ConditionRule {
  field: string; // `key`-ul altui câmp din același șablon
  operator: "equals" | "not_equals";
  value: string;
}

// Mapare explicită pe entitatea internă "Cerere" (Scenariul 1, pct. 3) — pur descriptiv,
// nu schimbă cum `DmsRequest.data` e populat la depunere.
export type CanonicalRole = "NUME" | "EMAIL" | "CUI" | "TELEFON" | "ADRESA";

export const CANONICAL_ROLES: { value: CanonicalRole; label: string }[] = [
  { value: "NUME", label: "Nume" },
  { value: "EMAIL", label: "E-mail" },
  { value: "CUI", label: "CUI" },
  { value: "TELEFON", label: "Telefon" },
  { value: "ADRESA", label: "Adresă" },
];
