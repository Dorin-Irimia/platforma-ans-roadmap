import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// Prag unic pentru "sidebar permanent" vs. "sidebar tip sertar (drawer)" — sub 1024px
// (tabletă portret și telefon) nu mai există loc pentru sidebar-ul de 236px + conținut
// pe două coloane fără să se producă exact tăierea/suprapunerea din capturile de test.
export const MOBILE_BREAKPOINT = "(max-width: 1024px)";
export const useIsMobile = () => useMediaQuery(MOBILE_BREAKPOINT);
