import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../iam/AuthContext";
import { TOURS, Tour, TourStep, buildNavStep } from "./tours";

interface TutorialContextValue {
  availableTours: Tour[];
  activeTour: Tour | null;
  steps: TourStep[]; // pasul sintetic de navigare (index 0) + pașii din `tour.steps`
  stepIndex: number;
  startTour: (id: string) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

function isDynamicRoute(route: string): boolean {
  return route.includes(":");
}

function routePrefix(route: string): string {
  return route.split(":")[0];
}

// Montat deasupra `<Routes>` în `App.tsx` (nu în `AppShell.tsx`, care se remontează la
// fiecare schimbare de rută — starea turului s-ar pierde la navigare). Are nevoie totuși
// de `useNavigate`/`useLocation`, deci trebuie să rămână în interiorul `<BrowserRouter>`.
export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  // Ultima rută dinamică (ex. /registratura/:id) chiar vizitată în acest tur — permite
  // pașilor ulteriori să revină la EXACT aceeași înregistrare, via `autoRoute: "$capturedPath"`.
  const [capturedPath, setCapturedPath] = useState<string | null>(null);

  const availableTours = TOURS.filter((t) => !t.roles || (user && t.roles.includes(user.role)));
  const activeTour = activeTourId ? TOURS.find((t) => t.id === activeTourId) || null : null;
  const steps = activeTour ? [buildNavStep(activeTour), ...activeTour.steps] : [];

  // Toate tururile încep de la Dashboard (pct. cerut explicit) — pasul 0 e mereu
  // "apasă pe X în meniul din stânga", indiferent de pagina de pe care s-a pornit turul.
  function startTour(id: string) {
    const tour = TOURS.find((t) => t.id === id);
    if (!tour) return;
    setStepIndex(0);
    setActiveTourId(id);
    setCapturedPath(null);
    if (location.pathname !== "/") navigate("/");
  }

  function stop() {
    setActiveTourId(null);
    setStepIndex(0);
    setCapturedPath(null);
  }

  function next() {
    if (!activeTour) return;
    const step = steps[stepIndex];
    // Pas de tip "așteaptă navigare" pe o rută STATICĂ (ex. pasul de sidebar): dacă userul
    // apasă "Următorul" în loc să dea click direct pe element, navigăm noi în locul lui.
    // Pe rute dinamice (ex. /registratura/:id) nu există o singură destinație — userul
    // trebuie să aleagă el însuși (un rând din tabel etc.), deci aici doar avansăm.
    if (step?.awaitRoute && !isDynamicRoute(step.awaitRoute) && location.pathname !== step.awaitRoute) {
      navigate(step.awaitRoute);
      return;
    }
    if (stepIndex >= steps.length - 1) {
      stop();
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function prev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  // Motor de navigare al turului — generalizează logica pentru orice pas, nu doar pasul 0:
  // - `awaitRoute`: nu navigăm noi; doar verificăm dacă userul a ajuns acolo singur (click pe
  //   sidebar, pe un rând de tabel etc.) și avansăm automat la pasul următor. Pe rute dinamice,
  //   reținem calea exactă în `capturedPath` pentru pași ulteriori.
  // - `autoRoute`: navigăm noi automat, imediat ("$capturedPath" = ultima rută dinamică reținută).
  useEffect(() => {
    if (!activeTour) return;
    const step = steps[stepIndex];
    if (!step || step.gap) return;

    if (step.awaitRoute) {
      const dynamic = isDynamicRoute(step.awaitRoute);
      const prefix = routePrefix(step.awaitRoute);
      const matched = dynamic
        ? location.pathname.startsWith(prefix) && location.pathname.length > prefix.length
        : location.pathname === step.awaitRoute;
      if (matched) {
        if (dynamic) setCapturedPath(location.pathname);
        if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
      }
      return;
    }

    if (step.autoRoute) {
      // "$capturedPath" sau "$capturedPath/suffix" — revine la ultima rută dinamică
      // reținută, eventual cu o sub-rută adăugată (ex. din editorul unui curs LMS spre
      // vizualizarea de cursant a aceluiași curs, "$capturedPath/learn").
      const target = step.autoRoute.startsWith("$capturedPath")
        ? capturedPath && capturedPath + step.autoRoute.slice("$capturedPath".length)
        : step.autoRoute;
      if (target && location.pathname !== target) navigate(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, stepIndex, activeTour?.id]);

  return (
    <TutorialContext.Provider value={{ availableTours, activeTour, steps, stepIndex, startTour, next, prev, stop }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
