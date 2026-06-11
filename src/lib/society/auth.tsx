import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ADMIN_EMAIL, db, useDB, type AuthUser } from "./db";

interface AuthCtx {
  user: AuthUser | null;
  signIn: (email: string, name?: string) => AuthUser;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useDB((s) => s.auth);
  const [, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const signIn = (email: string, name?: string): AuthUser => {
    const normalized = email.trim().toLowerCase();
    const role = normalized === ADMIN_EMAIL ? "admin" : "resident";
    const u: AuthUser = {
      email: normalized,
      name: name || normalized.split("@")[0],
      role,
    };
    db.set((s) => ({ ...s, auth: u }));
    return u;
  };

  const signOut = () => db.set((s) => ({ ...s, auth: null }));

  return <Ctx.Provider value={{ user, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}

export { ADMIN_EMAIL };
