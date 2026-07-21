import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { setAuthToken, fetchMe, fetchAuthPolicy, Me } from "./api";

const STORAGE_KEY = "ans_demo_token";
const STORAGE_TS_KEY = "ans_demo_token_ts";

interface AuthContextValue {
  user: Me | null;
  token: string | null;
  loading: boolean;
  signIn: (token: string, user: Me | { id: string; email: string; role: string }) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const signOutRef = useRef<() => void>(() => {});

  // La montare: dacă există un token salvat, îl validăm imediat contra API-ului
  // (/me) în loc să presupunem că e valid — evită sesiuni "fantomă" expirate.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }
    if (!localStorage.getItem(STORAGE_TS_KEY)) {
      localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
    }
    setAuthToken(saved);
    fetchMe()
      .then((me) => {
        setToken(saved);
        setUser(me);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_TS_KEY);
        setAuthToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function signIn(newToken: string, newUser: Me | { id: string; email: string; role: string }) {
    localStorage.setItem(STORAGE_KEY, newToken);
    localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
    setAuthToken(newToken);
    setToken(newToken);
    setUser({ isActive: true, ...newUser });
  }

  function signOut() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TS_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }

  signOutRef.current = signOut;

  async function refresh() {
    // Nu depinde de state-ul `token` (care poate fi încă vechi în același ciclu de
    // randare imediat după signIn) — antetul Authorization e deja setat sincron
    // pe instanța axios prin setAuthToken(), deci putem apela API-ul direct.
    const me = await fetchMe();
    setUser(me);
  }

  // Cap de sesiune configurabil (politică de autentificare) — verificare periodică
  // pe client, deconectare automată la depășire. Nu schimbă durata reală a
  // tokenului Supabase, doar impune o limită suplimentară la nivel de aplicație.
  useEffect(() => {
    if (!token) return;
    let sessionMinutes = 60;
    fetchAuthPolicy()
      .then((policy) => { sessionMinutes = policy.sessionMinutes; })
      .catch(() => {});
    const interval = setInterval(() => {
      const ts = Number(localStorage.getItem(STORAGE_TS_KEY) || 0);
      if (ts && Date.now() - ts > sessionMinutes * 60_000) {
        signOutRef.current();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
