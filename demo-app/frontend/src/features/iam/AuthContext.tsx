import { createContext, useContext, useState, ReactNode } from "react";
import { setAuthToken } from "./api";

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  function signIn(newToken: string, newUser: AuthUser) {
    setToken(newToken);
    setUser(newUser);
    setAuthToken(newToken);
  }

  function signOut() {
    setToken(null);
    setUser(null);
    setAuthToken(null);
  }

  return <AuthContext.Provider value={{ user, token, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
