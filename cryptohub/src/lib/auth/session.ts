import { AccessTokenResponse, AuthenticatedUser } from "@/types";

const TOKEN_KEY = "cryptohub_access_token";

/**
 * Access token storage.
 *
 * The token is kept in localStorage so a reload does not sign the user out.
 * That is a deliberate trade-off: localStorage is readable by any script on
 * the page, so it is only acceptable while this application serves no
 * third-party script and no XSS. An httpOnly, SameSite=Strict cookie set by
 * the server is the stronger choice and is the right upgrade before real
 * accounts are onboarded.
 */
export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * fetch with the access token attached.
 *
 * A 401 is turned into an UnauthorizedError so callers can react to a dead
 * session instead of silently rendering an empty account.
 */
export async function authFetch(
  input: string,
  init: RequestInit & { allowUnauthorized?: boolean } = {}
): Promise<Response> {
  const token = readToken();
  const headers = new Headers(init.headers);

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 && !init.allowUnauthorized) {
    const payload = await res.json().catch(() => ({}));
    clearToken();
    throw new UnauthorizedError(payload?.error || "Your session has expired. Sign in again.");
  }

  return res;
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AccessTokenResponse> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data?.error || "Registration failed.");
  }

  writeToken(data.token);
  return data;
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<AccessTokenResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data?.error || "Sign in failed.");
  }

  writeToken(data.token);
  return data;
}

export async function logoutAccount(): Promise<void> {
  try {
    await authFetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* the token is discarded regardless of what the server replies */
  }
  clearToken();
}

/**
 * Confirms a stored token is still valid and returns the identity behind it.
 * Used on mount so a tampered or stale token cannot leave the UI in a state
 * where it looks signed in but every request 401s.
 */
export async function restoreSession(): Promise<AuthenticatedUser | null> {
  const token = readToken();
  if (!token) return null;

  try {
    const res = await authFetch("/api/profile", { allowUnauthorized: true });
    if (!res.ok) {
      clearToken();
      return null;
    }
    const data = await res.json();
    return (data.user as AuthenticatedUser) ?? null;
  } catch {
    clearToken();
    return null;
  }
}