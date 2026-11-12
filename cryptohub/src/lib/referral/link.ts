import { NextRequest } from "next/server";

const OFFICIAL_APP_URL = "https://www.cryptoworldinvest.world";

const LEGACY_HOSTS = [
  "localhost",
  "127.0.0.1",
  "cryptohub.trade",
  "cryptoworldinvestment.vercel.app",
];

function isUsableProductionOrigin(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return !LEGACY_HOSTS.some((host) => lower.includes(host));
}

/**
 * Derives a secure, production-grade referral link anchored to the official
 * domain (https://www.cryptoworldinvest.world) using the clean `/join` route.
 */
export function buildReferralShareUrl(code: string, req?: NextRequest): string {
  let base = (process.env.NEXT_PUBLIC_APP_URL || "").trim();

  if (!isUsableProductionOrigin(base) && req) {
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost && isUsableProductionOrigin(forwardedHost)) {
      base = `${proto}://${forwardedHost}`;
    }
  }

  if (!isUsableProductionOrigin(base)) {
    base = OFFICIAL_APP_URL;
  }

  // Ensure no trailing slash
  base = base.replace(/\/+$/, "");

  // Word: 'join' instead of default root or localhost query
  return `${base}/join?ref=${encodeURIComponent(code)}`;
}

