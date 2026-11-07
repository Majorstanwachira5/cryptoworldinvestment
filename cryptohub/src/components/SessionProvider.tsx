"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccountType, AuthenticatedUser } from "@/types";
import {
  loginAccount,
  logoutAccount,
  registerAccount,
  restoreSession,
} from "@/lib/auth/session";

type Status = "LOADING" | "AUTHENTICATED" | "ANONYMOUS";

interface SessionContextValue {
  status: Status;
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  /** Account the user was trying to enter when they were asked to sign in. */
  pendingAccountType: AccountType | null;
  /**
   * The gate. Resolves true when the caller may open the account immediately,
   * and false after recording which account they wanted, so the UI can send
   * them through sign-in and continue to it afterwards.
   */
  requestAccountAccess: (accountType: AccountType) => Promise<boolean>;
  clearPendingAccount: () => void;
  login: (input: { email: string; password: string }) => Promise<AuthenticatedUser>;
  register: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Holds the access token's owner for the whole app.
 *
 * `requestAccountAccess` is the gate: it returns true when the caller may
 * proceed straight away, and otherwise records which account they were trying
 * to reach so the UI can send them through sign-in and continue afterwards.
 */
export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>("LOADING");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [pendingAccountType, setPendingAccountType] = useState<AccountType | null>(null);

  // The in-flight restore, so a click during startup can await the verdict
  // instead of being wrongly told to sign in.
  const restoreRef = useRef<Promise<AuthenticatedUser | null> | null>(null);
  // Mirrors of state for use inside callbacks that run after an await.
  const statusRef = useRef<Status>(status);
  statusRef.current = status;

  useEffect(() => {
    let active = true;

    const pending = restoreSession();
    restoreRef.current = pending;

    pending.then((restored) => {
      if (!active) return;
      setUser(restored);
      setStatus(restored ? "AUTHENTICATED" : "ANONYMOUS");
    });

    return () => {
      active = false;
      restoreRef.current = null;
    };
  }, []);

  const requestAccountAccess = useCallback(async (accountType: AccountType) => {
    if (statusRef.current === "LOADING" && restoreRef.current) {
      await restoreRef.current;
    }

    if (statusRef.current === "AUTHENTICATED") return true;

    setPendingAccountType(accountType);
    return false;
  }, []);

  const clearPendingAccount = useCallback(() => setPendingAccountType(null), []);

  const login = useCallback(async (input: { email: string; password: string }) => {
    const result = await loginAccount(input);
    setUser(result.user);
    setStatus("AUTHENTICATED");
    return result.user;
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const result = await registerAccount(input);
      setUser(result.user);
      setStatus("AUTHENTICATED");
      return result.user;
    },
    []
  );

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
    setStatus("ANONYMOUS");
    setPendingAccountType(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === "AUTHENTICATED",
      pendingAccountType,
      requestAccountAccess,
      clearPendingAccount,
      login,
      register,
      logout,
    }),
    [status, user, pendingAccountType, requestAccountAccess, clearPendingAccount, login, register, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside a SessionProvider.");
  }
  return context;
}
