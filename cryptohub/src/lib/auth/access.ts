import crypto from "crypto";
import { NextRequest } from "next/server";
import { AuthenticatedUser, Permission, Role } from "@/types";
import { db } from "@/lib/db";
import { credentials, PublicUser } from "./credentials";
import { can, isRole, permissionForAccount } from "./rbac";

const ALGORITHM = "sha256";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface AccessClaims {
  sub: string;
  email: string;
  name: string;
  role: Role;
  /** Marks a token this server or the Admin Authority minted. */
  iss: "cryptohub" | "cryptohub_admin";
  iat: number;
  exp: number;
}

function secret(): string {
  return process.env.JWT_SECRET || "cryptohub_ai_super_secret_jwt_key_2026";
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(data: string): string {
  return base64Url(crypto.createHmac(ALGORITHM, secret()).update(data).digest());
}

/**
 * Issues the platform access token.
 *
 * The token identifies a user and nothing else. It deliberately does not
 * carry an account type: which book a request touches is a parameter of that
 * request, checked against the caller's permissions, not a claim frozen at
 * login.
 */
export function issueAccessToken(
  user: PublicUser | AuthenticatedUser,
  ttlSeconds = DEFAULT_TTL_SECONDS
): { token: string; expiresAt: number } {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;

  const claims: AccessClaims = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iss: "cryptohub",
    iat,
    exp,
  };

  const header = base64Url(JSON.stringify({ alg: ALGORITHM, typ: "JWT" }));
  const body = base64Url(JSON.stringify(claims));

  return { token: `${header}.${body}.${sign(`${header}.${body}`)}`, expiresAt: exp };
}

/** Verifies a token this server minted. Returns null for anything else. */
export function verifyAccessToken(token: string): AccessClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let claims: AccessClaims;
  try {
    claims = JSON.parse(fromBase64Url(body));
  } catch {
    return null;
  }

  if (claims.iss !== "cryptohub" && claims.iss !== "cryptohub_admin") return null;
  if (!claims.sub || !claims.email) return null;
  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
  if (!isRole(claims.role)) return null;

  return claims;
}

/**
 * Verifies a Supabase-issued access token by asking Supabase who it belongs
 * to.
 *
 * The signature is not checked locally: Supabase signs with its own secret,
 * so the only trustworthy answer to "is this token real and unexpired" comes
 * from the issuer. Returns null when Supabase is unreachable, which fails
 * closed rather than treating an unverifiable token as valid.
 */
async function verifySupabaseToken(token: string): Promise<AuthenticatedUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.id || !data?.email) return null;

    return credentials.ensureUser({
      id: String(data.id),
      email: String(data.email),
      name: (data.user_metadata?.name || data.email).toString().slice(0, 80),
    }) as AuthenticatedUser;
  } catch {
    return null;
  }
}

export interface Identity {
  user: AuthenticatedUser;
  provider: "LOCAL" | "SUPABASE";
  /** Present when the claims were readable locally. */
  issuedAt?: number;
  expiresAt?: number;
}

/**
 * Resolves a bearer token to a verified identity.
 *
 * A token this server minted is checked locally. Anything else is offered to
 * Supabase. A token that neither accepts is rejected — there is no fallback
 * that trusts an unverified token.
 */
export async function resolveIdentity(token: string): Promise<Identity | null> {
  const claims = verifyAccessToken(token);
  if (claims) {
    const known = credentials.findById(claims.sub);
    return {
      user: {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        role: known?.role ?? claims.role,
        kycStatus: known?.kycStatus ?? "UNVERIFIED",
        createdAt: known?.createdAt ?? new Date().toISOString(),
        riskCertifiedAt: known?.riskCertifiedAt ?? null,
        provider: "LOCAL",
      },
      provider: "LOCAL",
      issuedAt: claims.iat,
      expiresAt: claims.exp,
    };
  }

  const supabaseUser = await verifySupabaseToken(token);
  if (!supabaseUser) return null;

  // Supabase already vouched for this token, so reading its timestamps for
  // display is safe even though its signature was not checked here.
  const decoded = decodeTimestamps(token);

  return {
    user: supabaseUser,
    provider: "SUPABASE",
    issuedAt: decoded.iat,
    expiresAt: decoded.exp,
  };
}

/** Reads iat/exp without verifying. Display use only. */
function decodeTimestamps(token: string): { iat?: number; exp?: number } {
  try {
    const body = JSON.parse(fromBase64Url(token.split(".")[1]));
    return {
      iat: typeof body.iat === "number" ? body.iat : undefined,
      exp: typeof body.exp === "number" ? body.exp : undefined,
    };
  } catch {
    return {};
  }
}

export function readBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (header) {
    const [scheme, token] = header.split(" ");
    if (token && scheme.toLowerCase() === "bearer") {
      return token.trim() || null;
    }
  }
  const cookieToken =
    request.cookies.get("cryptohub_session")?.value ||
    request.cookies.get("admin_session")?.value;
  if (cookieToken) return cookieToken.trim();
  return null;
}

export type GuardFailure = { ok: false; status: 401 | 403; error: string };

/**
 * Returns the platform data owner for a verified identity, creating the
 * profile and both books on first sight.
 *
 * Every authenticated route calls this once and then passes the returned id
 * to the store. Because the id is derived from the token rather than from the
 * request body, a caller cannot point the store at somebody else's records.
 */
export function platformUserId(identity: Identity): string {
  const id = identity.user.id;
  db.ensureUser({
    id,
    email: identity.user.email,
    name: identity.user.name,
    role: identity.user.role,
  });
  return id;
}

/**
 * Requires a valid access token.
 *
 * Returns either the identity or the exact response to send. Handlers must
 * not proceed on the failure branch.
 */
export async function requireIdentity(request: NextRequest): Promise<
  { ok: true; identity: Identity } | GuardFailure
> {
  const token = readBearerToken(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required. Register or sign in to access an account.",
    };
  }

  const identity = await resolveIdentity(token);
  if (!identity) {
    return {
      ok: false,
      status: 401,
      error: "Your session is invalid or has expired. Sign in again.",
    };
  }

  return { ok: true, identity };
}

export type PermissionFailure = { ok: false; status: 401 | 403; error: string };

/**
 * Requires an authenticated identity holding `permission`.
 *
 * A 403 here means the caller is known but not allowed, which is deliberately
 * distinct from the 401 an unknown caller receives.
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission
): Promise<{ ok: true; identity: Identity } | PermissionFailure> {
  const auth = await requireIdentity(request);
  if (!auth.ok) return auth;

  if (!can(auth.identity.user.role, permission)) {
    return {
      ok: false,
      status: 403,
      error: `Your role (${auth.identity.user.role}) is not permitted to perform this action.`,
    };
  }

  return auth;
}

/** Requires the caller to be an administrator. */
export async function requireAdmin(
  request: NextRequest
): Promise<{ ok: true; identity: Identity } | PermissionFailure> {
  return requirePermission(request, "admin:stats");
}

/**
 * Resolves the account type a request wants and checks the matching
 * permission. Strictly enforces REAL-only live trading; paper/demo trading is prohibited.
 */
export async function requireAccountAccess(
  request: NextRequest,
  requested: unknown = "REAL"
): Promise<
  | { ok: true; identity: Identity; accountType: "REAL" }
  | PermissionFailure
> {
  const norm = requested ? String(requested).toUpperCase() : "REAL";
  if (norm !== "REAL") {
    return {
      ok: false,
      status: 403,
      error: "Paper/Demo trading is disabled. Platform operates strictly on REAL live accounts.",
    };
  }

  const auth = await requirePermission(request, permissionForAccount("REAL"));
  if (!auth.ok) return auth;

  return { ok: true, identity: auth.identity, accountType: "REAL" };
}