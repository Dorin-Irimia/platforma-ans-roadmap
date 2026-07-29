import { useAuth } from "../features/iam/AuthContext";
import { TRANSLATIONS, Language } from "./translations";

const DEFAULT_LANGUAGE: Language = "ro";

function isLanguage(v: unknown): v is Language {
  return typeof v === "string" && v in TRANSLATIONS;
}

// Limba activă vine direct din contul autentificat (User.language, salvat din Setări cont)
// — nu dintr-o preferință locală separată, ca să rămână aceeași pe orice dispozitiv unde
// utilizatorul se conectează.
export function useTranslation() {
  const { user } = useAuth();
  const language: Language = isLanguage(user?.language) ? user!.language : DEFAULT_LANGUAGE;
  const dict = TRANSLATIONS[language];

  function t(key: string): string {
    return dict[key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key] ?? key;
  }

  return { t, language };
}
