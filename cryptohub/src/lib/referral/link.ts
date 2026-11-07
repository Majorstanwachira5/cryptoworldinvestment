import { NextRequest } from "next/server";

/**
 * Derives a secure, production-grade referral link without "localhost"
 * Uses a clean path word ("join") and falls back to production domain.
 */
export function buildReferralShareUrl(code: string, req?: NextRequest): string {
  let base = process.env.NEXT_PUBLIC_APP_URL || "";
  
  if (!base || base.includes("localhost")) {
    if (req) {
      const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
      const proto = req.headers.get("x-forwarded-proto") || "https";
      if (forwardedHost && !forwardedHost.includes("localhost")) {
        base = `${proto}://${forwardedHost}`;
      }
    }
  }

  if (!base || base.includes("localhost")) {
    base = "https://cryptohub.trade";
  }

  // Ensure no trailing slash
  base = base.replace(/\/+$/, "");

  // Word: 'join' instead of default root or localhost query
  return `${base}/join?ref=${encodeURIComponent(code)}`;
}

