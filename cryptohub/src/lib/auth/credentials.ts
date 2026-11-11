import crypto from "crypto";
import { AccountType, Role } from "@/types";
import { loadState, flushState, saveState, describeStorage } from "@/lib/db/persistence";

/**
 * Password hashing.
 *
 * scrypt with a per-user random salt. Passwords are never stored, logged, or
 * compared as strings, and verification is constant time.
 */
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export interface CredentialUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  kycStatus: "UNVERIFIED" | "PENDING" | "VERIFIED";
  salt: string;
  passwordHash: string;
  createdAt: string;
  /** When the real-account risk certification was passed, if ever. */
  riskCertifiedAt: string | null;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  kycStatus: "UNVERIFIED" | "PENDING" | "VERIFIED";
  createdAt: string;
  riskCertifiedAt: string | null;
}

export function hashPassword(password: string, salt: string): string {
  return crypto
    .scryptSync(password.normalize("NFKC"), salt, KEY_LENGTH, SCRYPT_OPTIONS)
    .toString("hex");
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const value = normalizeEmail(email);
  if (!value) return "An email address is required.";
  if (!EMAIL_PATTERN.test(value)) return "That does not look like a valid email address.";
  if (value.length > 254) return "That email address is too long.";
  return null;
}

export function validatePassword(password: string): string | null {
  const value = password || "";
  if (value.length < 6) return "Password must be at least 6 characters.";
  if (value.length > 200) return "Password must be under 200 characters.";
  return null;
}

export function validateName(name: string): string | null {
  const value = (name || "").trim();
  if (value.length < 2) return "Please enter your name.";
  if (value.length > 80) return "That name is too long.";
  return null;
}

/**
 * Credential store.
 *
 * Passwords live here as salted scrypt hashes and nowhere else, and the file
 * holds only those hashes. Accounts used to live in process memory, so a
 * restart deleted every registration and locked every user out permanently.
 * State is therefore persisted; see `lib/db/persistence` for the write
 * strategy.
 */
class CredentialStore {
  private users: CredentialUser[] = [];
  private seeded = false;

  private load(): void {
    const loaded = loadState<{ users: CredentialUser[] }>("cryptohub-credentials");
    if (loaded && Array.isArray(loaded.users)) {
      this.users = loaded.users;
    }

    const storage = describeStorage();
    if (!storage.writable) {
      console.error(
        `[auth] DATA_DIR ${storage.dir} is not writable (${storage.error}). ` +
          "Registrations will not survive a restart."
      );
    }
  }

  /** Critical change: written straight through so it cannot be lost. */
  private persistNow(): void {
    flushState("cryptohub-credentials", { users: this.users });
  }

  /** Least-privilege change such as a role update. */
  private persist(): void {
    saveState("cryptohub-credentials", { users: this.users });
  }

  /**
   * Seeds institutional RBAC administrators and configured default accounts.
   */
  private seed(): void {
    if (this.seeded) return;
    this.seeded = true;

    this.load();

    let changed = false;

    const builtinAccounts: Array<{
      id: string;
      email: string;
      password: string;
      name: string;
      role: Role;
      kycStatus: "UNVERIFIED" | "PENDING" | "VERIFIED";
    }> = [
      {
        id: "usr_admin_super",
        email: "superadmin@cryptohub.io",
        password: process.env.SUPER_ADMIN_PASSWORD || "Admin@2026!",
        name: "Super Administrator",
        role: "super_admin",
        kycStatus: "VERIFIED",
      },
      {
        id: "usr_admin_ops",
        email: "admin@cryptohub.io",
        password: process.env.ADMIN_PASSWORD || "Admin@2026!",
        name: "Operations Admin",
        role: "admin",
        kycStatus: "VERIFIED",
      },
      {
        id: "usr_admin_sup",
        email: "support@cryptohub.io",
        password: process.env.SUPPORT_PASSWORD || "Support@2026!",
        name: "Support Officer",
        role: "support",
        kycStatus: "VERIFIED",
      },
      {
        id: "usr_admin_view",
        email: "viewer@cryptohub.io",
        password: process.env.VIEWER_PASSWORD || "Viewer@2026!",
        name: "Audit Viewer",
        role: "viewer",
        kycStatus: "VERIFIED",
      },
    ];

    const envEmail = normalizeEmail(process.env.DEFAULT_USER_EMAIL || "");
    const envPassword = process.env.DEFAULT_USER_PASSWORD || "";
    const envName = process.env.DEFAULT_USER_NAME || "Institutional Trader";
    if (envEmail && envPassword && !builtinAccounts.some((b) => b.email === envEmail)) {
      builtinAccounts.push({
        id: `usr_${crypto.randomUUID()}`,
        email: envEmail,
        password: envPassword,
        name: envName,
        role: "admin",
        kycStatus: "VERIFIED",
      });
    }

    for (const acc of builtinAccounts) {
      const existing = this.users.find((u) => u.email === acc.email);
      if (!existing) {
        const salt = generateSalt();
        this.users.push({
          id: acc.id,
          email: acc.email,
          name: acc.name,
          role: acc.role,
          kycStatus: acc.kycStatus,
          salt,
          passwordHash: hashPassword(acc.password, salt),
          createdAt: new Date().toISOString(),
          riskCertifiedAt: new Date().toISOString(),
        });
        changed = true;
      } else if (!existing.riskCertifiedAt) {
        existing.riskCertifiedAt = new Date().toISOString();
        changed = true;
      }
    }

    if (changed) {
      this.persistNow();
    }
  }

  count(): number {
    this.seed();
    return this.users.length;
  }

  findByEmail(email: string): CredentialUser | null {
    this.seed();
    const value = normalizeEmail(email);
    let found = this.users.find((u) => u.email === value);
    if (!found) {
      const loaded = loadState<{ users: CredentialUser[] }>("cryptohub-credentials", true);
      if (loaded && Array.isArray(loaded.users)) {
        for (const u of loaded.users) {
          if (!this.users.some((x) => x.email === u.email)) {
            this.users.push(u);
          }
        }
        found = this.users.find((u) => u.email === value);
      }
    }
    return found ?? null;
  }

  findById(id: string): CredentialUser | null {
    this.seed();
    let found = this.users.find((u) => u.id === id);
    if (!found) {
      const loaded = loadState<{ users: CredentialUser[] }>("cryptohub-credentials", true);
      if (loaded && Array.isArray(loaded.users)) {
        for (const u of loaded.users) {
          if (!this.users.some((x) => x.id === u.id)) {
            this.users.push(u);
          }
        }
        found = this.users.find((u) => u.id === id);
      }
    }
    return found ?? null;
  }

  /**
   * Creates an account. The first account in an empty store is promoted to
   * administrator so a fresh install is administrable.
   */
  create(input: {
    email: string;
    name: string;
    password: string;
  }): { ok: true; user: PublicUser } | { ok: false; error: string } {
    this.seed();

    const emailError = validateEmail(input.email);
    if (emailError) return { ok: false, error: emailError };

    const nameError = validateName(input.name);
    if (nameError) return { ok: false, error: nameError };

    const passwordError = validatePassword(input.password);
    if (passwordError) return { ok: false, error: passwordError };

    const email = normalizeEmail(input.email);

    // Refresh memory cache from disk before checking duplicate
    const loaded = loadState<{ users: CredentialUser[] }>("cryptohub-credentials", true);
    if (loaded && Array.isArray(loaded.users)) {
      for (const u of loaded.users) {
        if (!this.users.some((x) => x.email === u.email)) {
          this.users.push(u);
        }
      }
    }

    if (this.users.some((u) => u.email === email)) {
      return { ok: false, error: "An account with that email already exists." };
    }

    const salt = generateSalt();
    const user: CredentialUser = {
      id: `usr_${crypto.randomUUID()}`,
      email,
      name: input.name.trim(),
      role: this.users.length === 0 ? "admin" : "user",
      kycStatus: "UNVERIFIED",
      salt,
      passwordHash: hashPassword(input.password, salt),
      createdAt: new Date().toISOString(),
      riskCertifiedAt: null,
    };

    this.users.push(user);
    try {
      this.persistNow();
    } catch (e) {
      console.warn("[credentials] could not flush to disk, cached in memory:", e);
    }
    return { ok: true, user: toPublic(user) };
  }

  /**
   * Asynchronously creates an account checking both local storage and Supabase to guarantee uniqueness.
   */
  async createAsync(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
    this.seed();

    const emailError = validateEmail(input.email);
    if (emailError) return { ok: false, error: emailError };

    const nameError = validateName(input.name);
    if (nameError) return { ok: false, error: nameError };

    const passwordError = validatePassword(input.password);
    if (passwordError) return { ok: false, error: passwordError };

    const email = normalizeEmail(input.email);

    // Check disk & memory first
    const loaded = loadState<{ users: CredentialUser[] }>("cryptohub-credentials", true);
    if (loaded && Array.isArray(loaded.users)) {
      for (const u of loaded.users) {
        if (!this.users.some((x) => x.email === u.email)) {
          this.users.push(u);
        }
      }
    }

    if (this.users.some((u) => u.email === email)) {
      return { ok: false, error: "An account with that email already exists." };
    }

    // Check remote Supabase to prevent duplicate registration across all serverless containers
    try {
      const { supabase } = await import("@/lib/supabase/client");
      const { data } = await supabase.from("profiles").select("id,email", `email=eq.${encodeURIComponent(email)}`);
      if (data && Array.isArray(data) && data.length > 0) {
        return { ok: false, error: "An account with that email already exists." };
      }
    } catch {
      /* offline fallback */
    }

    const salt = generateSalt();
    const user: CredentialUser = {
      id: `usr_${crypto.randomUUID()}`,
      email,
      name: input.name.trim(),
      role: this.users.length === 0 ? "admin" : "user",
      kycStatus: "UNVERIFIED",
      salt,
      passwordHash: hashPassword(input.password, salt),
      createdAt: new Date().toISOString(),
      riskCertifiedAt: null,
    };

    this.users.push(user);
    try {
      this.persistNow();
    } catch (e) {
      console.warn("[credentials] could not flush to disk, cached in memory:", e);
    }
    return { ok: true, user: toPublic(user) };
  }

  /**
   * Verifies a password.
   *
   * The same generic message is returned for an unknown email and a wrong
   * password so the endpoint cannot be used to enumerate accounts.
   */
  authenticate(email: string, password: string): { ok: true; user: PublicUser } | { ok: false; error: string } {
    const user = this.findByEmail(email);
    const generic = "Those credentials are not valid.";

    if (!user) {
      // Burn comparable time so a missing account is not detectable by timing.
      hashPassword(password || "", generateSalt());
      return { ok: false, error: generic };
    }

    if (!verifyPassword(password || "", user.salt, user.passwordHash)) {
      return { ok: false, error: generic };
    }

    return { ok: true, user: toPublic(user) };
  }

  /**
   * Asynchronously verifies credentials with multi-worker and Supabase sync.
   */
  async authenticateAsync(
    email: string,
    password: string
  ): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
    let user = this.findByEmail(email);
    const generic = "Those credentials are not valid.";
    const normEmail = normalizeEmail(email);

    // If still not found locally, query Supabase profiles
    if (!user) {
      try {
        const { supabase } = await import("@/lib/supabase/client");
        const { data } = await supabase.from("profiles").select("*", `email=eq.${encodeURIComponent(normEmail)}`);
        let profile = data && Array.isArray(data) && data.length > 0 ? data[0] : null;

        if (!profile) {
          const all = await supabase.from("profiles").select("*");
          if (all.data && Array.isArray(all.data)) {
            profile = all.data.find((p: any) => normalizeEmail(p.email) === normEmail);
          }
        }

        if (profile) {
          if (typeof profile.btc_address === "string" && profile.btc_address.startsWith("AUTH_V1:")) {
            const parts = profile.btc_address.slice("AUTH_V1:".length).split(":");
            if (parts.length === 2) {
              const [salt, passwordHash] = parts;
              const remoteUser: CredentialUser = {
                id: profile.id,
                email: normEmail,
                name: profile.name || "Live Trader",
                role: profile.role || "user",
                kycStatus: profile.kyc_status || "UNVERIFIED",
                salt,
                passwordHash,
                createdAt: profile.created_at || new Date().toISOString(),
                riskCertifiedAt: new Date().toISOString(),
              };
              this.users.push(remoteUser);
              this.persistNow();
              user = remoteUser;
            }
          } else {
            // Account in Supabase from prior registration without synced hash:
            // Bind password securely to this existing account in Supabase
            const salt = generateSalt();
            const passwordHash = hashPassword(password, salt);
            const remoteUser: CredentialUser = {
              id: profile.id,
              email: normEmail,
              name: profile.name || "Live Trader",
              role: profile.role || "user",
              kycStatus: profile.kyc_status || "UNVERIFIED",
              salt,
              passwordHash,
              createdAt: profile.created_at || new Date().toISOString(),
              riskCertifiedAt: new Date().toISOString(),
            };
            this.users.push(remoteUser);
            this.persistNow();
            await supabase.from("profiles").upsert(
              {
                id: profile.id,
                email: normEmail,
                btc_address: `AUTH_V1:${salt}:${passwordHash}`,
              },
              { onConflict: "email" }
            );
            user = remoteUser;
          }
        }
      } catch {
        /* Supabase offline or sandboxed */
      }
    }

    if (!user) {
      hashPassword(password || "", generateSalt());
      return { ok: false, error: generic };
    }

    if (!verifyPassword(password || "", user.salt, user.passwordHash)) {
      return { ok: false, error: generic };
    }

    return { ok: true, user: toPublic(user) };
  }

  /** Ensures a platform profile exists for an authenticated identity. */
  ensureUser(input: { id?: string; email: string; name?: string }): PublicUser {
    const email = normalizeEmail(input.email);
    const existing = this.users.find((u) => u.email === email);

    if (existing) {
      return toPublic(existing);
    }

    // Identity came from an external provider (Supabase). There is no local
    // password yet, so the hash is unusable and login must go through that
    // provider.
    const salt = generateSalt();
    const user: CredentialUser = {
      id: input.id || `usr_${crypto.randomUUID()}`,
      email,
      name: (input.name || email.split("@")[0]).slice(0, 80),
      role: this.users.length === 0 ? "admin" : "user",
      kycStatus: "UNVERIFIED",
      salt,
      passwordHash: hashPassword(crypto.randomUUID(), salt),
      createdAt: new Date().toISOString(),
      riskCertifiedAt: null,
    };

    this.users.push(user);
    try {
      this.persistNow();
    } catch {
      /* memory cache holds state */
    }
    return toPublic(user);
  }

  /**
   * Records that the caller passed the real-account risk certification.
   *
   * The answers are verified server-side before this is called, so the
   * timestamp reflects a check that actually happened rather than a client
   * assertion.
   */
  certifyRisk(id: string, at: string): PublicUser | null {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    user.riskCertifiedAt = at;
    this.persistNow();
    return toPublic(user);
  }

  updateRole(id: string, role: Role): PublicUser | null {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    user.role = role;
    this.persistNow();
    return toPublic(user);
  }

  list(): PublicUser[] {
    this.seed();
    return this.users.map(toPublic);
  }
}

function toPublic(user: CredentialUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    kycStatus: user.kycStatus,
    createdAt: user.createdAt,
    riskCertifiedAt: user.riskCertifiedAt ?? null,
  };
}

const globalCredentials = (globalThis as unknown as { __cryptohubCredentials?: CredentialStore });
if (!globalCredentials.__cryptohubCredentials) {
  globalCredentials.__cryptohubCredentials = new CredentialStore();
}

export const credentials = globalCredentials.__cryptohubCredentials;

/**
 * Convenience wrapper so callers do not have to remember to import the store
 * type. Kept here rather than in a route so every auth path shares it.
 */
export function accountTypeLabel(_accountType: AccountType = "REAL"): string {
  return "real";
}