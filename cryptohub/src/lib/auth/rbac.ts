import { Permission, Role } from "@/types";

/**
 * Role to permission mapping.
 *
 * This table is the single authority on what a role may do. Route handlers ask
 * `can(role, permission)`; nothing infers authority from the UI or from a
 * client-supplied flag.
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  user: ["trade:real", "ledger:read", "analysis:read", "referral:manage"],
  viewer: ["admin:stats", "admin:users:read", "ledger:read"],
  support: ["admin:stats", "admin:users:read", "admin:users:write", "ledger:read"],
  admin: [
    "trade:real",
    "ledger:read",
    "analysis:read",
    "referral:manage",
    "admin:stats",
    "admin:users:read",
    "admin:users:write",
    "admin:withdrawal:approve",
    "admin:reward:trigger",
    "admin:payments:manage",
    "admin:prediction-override",
  ],
  super_admin: [
    "trade:real",
    "ledger:read",
    "analysis:read",
    "referral:manage",
    "admin:stats",
    "admin:users:read",
    "admin:users:write",
    "admin:withdrawal:approve",
    "admin:reward:trigger",
    "admin:payments:manage",
    "admin:prediction-override",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function isRole(value: unknown): value is Role {
  return (
    value === "user" ||
    value === "viewer" ||
    value === "support" ||
    value === "admin" ||
    value === "super_admin"
  );
}

/**
 * Trading requires real account permission (`trade:real`).
 */
export function permissionForAccount(_accountType: "REAL" = "REAL"): Permission {
  return "trade:real";
}