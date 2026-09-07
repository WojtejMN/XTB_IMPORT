"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_STORAGE_KEY,
  currentUser,
  hashPassword,
  loginAccount,
  loginOrRegisterGoogle,
  logoutSession,
  readSnapshotFromStorage,
  registerAccount,
  serializeSnapshot,
  subscribeNewsletter,
} from "@/lib/auth/store";
import type { AuthStoreSnapshot, AuthUser, NewsletterResult } from "@/lib/auth/types";

type AuthMode = "login" | "register";

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  authOpen: boolean;
  authMode: AuthMode;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  continueWithGoogle: (
    email: string,
    name?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  subscribe: (email: string) => NewsletterResult;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AuthStoreSnapshot>({
    accounts: [],
    newsletter: [],
    sessionUserId: null,
  });
  const [ready, setReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  useEffect(() => {
    const loaded = readSnapshotFromStorage(window.localStorage.getItem(AUTH_STORAGE_KEY));
    setSnapshot(loaded);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, serializeSnapshot(snapshot));
  }, [snapshot, ready]);

  const persist = useCallback((next: AuthStoreSnapshot) => {
    setSnapshot(next);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      ready,
      user: currentUser(snapshot),
      authOpen,
      authMode,
      openAuth: (mode = "login") => {
        setAuthMode(mode);
        setAuthOpen(true);
      },
      closeAuth: () => setAuthOpen(false),
      login: async (email, password) => {
        const passwordHash = await hashPassword(password);
        const { snapshot: next, result } = loginAccount(snapshot, { email, passwordHash });
        if (!result.ok) {
          return result;
        }
        persist(next);
        setAuthOpen(false);
        return { ok: true };
      },
      register: async (name, email, password) => {
        const passwordHash = await hashPassword(password);
        const { snapshot: next, result } = registerAccount(snapshot, {
          name,
          email,
          password,
          passwordHash,
        });
        if (!result.ok) {
          return result;
        }
        persist(next);
        setAuthOpen(false);
        return { ok: true };
      },
      continueWithGoogle: async (email, name) => {
        const { snapshot: next, result } = loginOrRegisterGoogle(snapshot, { email, name });
        if (!result.ok) {
          return result;
        }
        persist(next);
        setAuthOpen(false);
        return { ok: true };
      },
      logout: () => persist(logoutSession(snapshot)),
      subscribe: (email) => {
        const { snapshot: next, result } = subscribeNewsletter(snapshot, email);
        if (result.ok) {
          persist(next);
        }
        return result;
      },
    };
  }, [ready, snapshot, authOpen, authMode, persist]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth musi być użyty wewnątrz AuthProvider.");
  }
  return context;
}
