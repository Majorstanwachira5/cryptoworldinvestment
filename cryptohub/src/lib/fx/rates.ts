export type DisplayCurrency = "USD" | "KES";

export interface FxRates {
  base: "USD";
  /** Units of KES per 1 USD. */
  usdKes: number;
  displayCurrency: DisplayCurrency;
  source: "ENV" | "DEFAULT";
}

const DEFAULT_USD_KES = 129.5;

const parse = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

let cached: FxRates | null = null;

/**
 * Resolves the USD -> KES rate.
 *
 * The rate is read from USD_KES_RATE so it can be corrected without a code
 * change, and it is cached per process because it only changes on deploy.
 */
export function getFxRates(): FxRates {
  if (cached) return cached;

  const fromEnv = process.env.USD_KES_RATE;
  cached = {
    base: "USD",
    usdKes: parse(fromEnv, DEFAULT_USD_KES),
    displayCurrency:
      (process.env.NEXT_PUBLIC_DISPLAY_CURRENCY as DisplayCurrency) === "USD"
        ? "USD"
        : "KES",
    source: fromEnv && Number.isFinite(Number(fromEnv)) ? "ENV" : "DEFAULT",
  };

  return cached;
}

/** Test seam so a fresh rate can be picked up without a restart. */
export function resetFxCache(): void {
  cached = null;
}

export function usdToKes(usd: number): number {
  return Math.round(usd * getFxRates().usdKes * 100) / 100;
}

export function kesToUsd(kes: number): number {
  return Math.round((kes / getFxRates().usdKes) * 100) / 100;
}

/**
 * Formats a USD amount in the requested currency.
 *
 * Every monetary figure the platform produces is denominated in USD, so this
 * is the single place a KES figure is produced. That keeps conversion in one
 * place instead of scattered across components.
 */
export function formatMoney(
  usd: number,
  currency: DisplayCurrency = getFxRates().displayCurrency,
  options: { compact?: boolean } = {}
): string {
  const value = currency === "KES" ? usdToKes(usd) : usd;

  if (!Number.isFinite(value)) return currency === "KES" ? "KSh 0.00" : "$0.00";

  const symbol = currency === "KES" ? "KSh " : "$";
  const digits = currency === "KES" ? 0 : 2;

  if (options.compact && Math.abs(value) >= 1000000) {
    return `${symbol}${(value / 1000000).toFixed(2)}M`;
  }
  if (options.compact && Math.abs(value) >= 1000) {
    return `${symbol}${(value / 1000).toFixed(1)}K`;
  }

  return `${symbol}${value.toLocaleString("en-KE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/**
 * Signed variant used for PnL, where the sign carries the meaning.
 */
export function formatSignedMoney(
  usd: number,
  currency: DisplayCurrency = getFxRates().displayCurrency
): string {
  const prefix = usd > 0 ? "+" : usd < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(usd), currency)}`;
}