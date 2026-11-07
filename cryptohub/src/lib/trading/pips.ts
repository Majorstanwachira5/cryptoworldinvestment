import { AssetClass } from "@/types";

/**
 * Returns the pip size for a given symbol
 * Forex: EUR/USD = 0.0001, USD/JPY = 0.01
 * Crypto: 1.00 USD
 */
export function getPipSize(symbol: string, assetClass: AssetClass): number {
  if (assetClass === "FOREX") {
    if (symbol.includes("JPY")) {
      return 0.01;
    }
    return 0.0001;
  }
  return 1.0;
}

/**
 * Calculate pips between entry and current/exit price
 */
export function calculatePips(
  entryPrice: number,
  currentPrice: number,
  direction: "LONG" | "SHORT",
  symbol: string,
  assetClass: AssetClass
): number {
  const pipSize = getPipSize(symbol, assetClass);
  const diff = direction === "LONG" ? currentPrice - entryPrice : entryPrice - currentPrice;
  return Math.round((diff / pipSize) * 10) / 10;
}

/**
 * Calculate Profit/Loss in USD
 * Forex: Standard Lot = 100,000 units. 1 Pip = $10 per standard lot for EURUSD.
 * Crypto: Size in coins * price difference
 */
export function calculatePnL(
  entryPrice: number,
  currentPrice: number,
  size: number,
  direction: "LONG" | "SHORT",
  assetClass: AssetClass,
  symbol: string
): number {
  const diff = direction === "LONG" ? currentPrice - entryPrice : entryPrice - currentPrice;

  if (assetClass === "FOREX") {
    const pipSize = getPipSize(symbol, assetClass);
    const pips = diff / pipSize;
    // Standard pip value: $10 per lot for 0.0001 pip pairs
    const pipValuePerLot = symbol.includes("JPY") ? (1000 / currentPrice) : 10.0;
    return Math.round(pips * pipValuePerLot * size * 100) / 100;
  }

  // Crypto:
  return Math.round(diff * size * 100) / 100;
}

/**
 * Risk-Based Position Size Calculator:
 * Calculates optimal position size to risk exactly X% of user balance if Stop Loss is triggered.
 */
export function calculateOptimalPositionSize(
  balance: number,
  riskPercent: number, // e.g. 2%
  entryPrice: number,
  stopLossPrice: number,
  assetClass: AssetClass,
  symbol: string
): { size: number; riskAmount: number; rewardRiskRatio: number } {
  const riskAmount = (balance * (riskPercent / 100));
  const priceDistance = Math.abs(entryPrice - stopLossPrice);

  if (priceDistance <= 0) {
    return { size: 0.1, riskAmount, rewardRiskRatio: 1.5 };
  }

  if (assetClass === "FOREX") {
    const pipSize = getPipSize(symbol, assetClass);
    const pipsRisked = priceDistance / pipSize;
    const pipValuePerLot = symbol.includes("JPY") ? 1000 / entryPrice : 10.0;
    let lots = Math.max(0.05, Math.round((riskAmount / (pipsRisked * pipValuePerLot)) * 100) / 100);
    lots = Math.min(1.0, lots); // Cap at 1.0 standard lot for safety
    return { size: lots, riskAmount, rewardRiskRatio: 2.0 };
  }

  // Crypto:
  let units = Math.max(0.01, Math.round((riskAmount / priceDistance) * 1000) / 1000);
  const maxSafeUnits = (balance * 0.5) / entryPrice;
  units = Number(
    Math.max(
      symbol.includes("BTC") ? 0.05 : symbol.includes("ETH") ? 0.5 : 2.0,
      Math.min(maxSafeUnits, units)
    ).toFixed(symbol.includes("BTC") ? 2 : symbol.includes("ETH") ? 2 : 1)
  );
  return { size: units, riskAmount, rewardRiskRatio: 2.0 };
}
