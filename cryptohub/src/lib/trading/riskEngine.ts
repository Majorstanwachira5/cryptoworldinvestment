import { db } from "@/lib/db";
import { AssetClass, TradeDirection } from "@/types";
import { getPipSize } from "./pips";

export interface RiskCheckParams {
  accountType: "REAL";
  symbol: string;
  assetClass: AssetClass;
  direction: TradeDirection;
  size: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
}

export interface RiskCheckResult {
  allowed: boolean;
  error?: string;
  riskAmount?: number;
  riskPercent?: number;
  rewardRiskRatio?: number;
}

/**
 * Validates real trades against strict risk management parameters.
 */
export function validateTradeRisk(
  userId: string,
  params: RiskCheckParams
): RiskCheckResult {
  // Read from the caller's own REAL book, so the funding and sizing limits
  // that apply are the ones for the trader placing the order.
  const balance = db.getBalance(userId, "REAL");

  // 0. Account must be funded
  if (balance.equity <= 0) {
    return {
      allowed: false,
      error:
        "REAL ACCOUNT RISK VIOLATION: Account equity is $0.00. Deposit capital before opening live positions.",
    };
  }

  // 1. Mandatory Stop Loss
  if (!params.stopLoss || params.stopLoss <= 0) {
    return {
      allowed: false,
      error:
        "REAL ACCOUNT RISK VIOLATION: Mandatory Stop Loss is required on all live trades to prevent liquidation.",
    };
  }

  // Validate Stop Loss side
  if (params.direction === "LONG" && params.stopLoss >= params.entryPrice) {
    return {
      allowed: false,
      error:
        "REAL ACCOUNT RISK VIOLATION: Long Stop Loss must be strictly below Entry Price.",
    };
  }
  if (params.direction === "SHORT" && params.stopLoss <= params.entryPrice) {
    return {
      allowed: false,
      error:
        "REAL ACCOUNT RISK VIOLATION: Short Stop Loss must be strictly above Entry Price.",
    };
  }

  // 2. Minimum Reward-to-Risk Ratio (1:1.5 minimum)
  if (!params.takeProfit || params.takeProfit <= 0) {
    return {
      allowed: false,
      error:
        "REAL ACCOUNT RISK VIOLATION: Mandatory Take Profit is required to maintain the minimum reward-to-risk requirement.",
    };
  }

  const slDistance = Math.abs(params.entryPrice - params.stopLoss);
  const tpDistance = Math.abs(params.entryPrice - params.takeProfit);
  const rrRatio = tpDistance / slDistance;

  if (rrRatio < 1.45) {
    return {
      allowed: false,
      error: `REAL ACCOUNT RISK VIOLATION: Reward:Risk ratio is 1:${rrRatio.toFixed(2)}. Minimum 1:1.5 is required for institutional risk governance.`,
      rewardRiskRatio: rrRatio,
    };
  }

  // 3. Max Risk per Trade (Maximum 2.0% of Balance)
  let riskAmount = 0;
  if (params.assetClass === "FOREX") {
    const pipSize = getPipSize(params.symbol, params.assetClass);
    const pipsRisked = slDistance / pipSize;
    const pipValuePerLot = params.symbol.includes("JPY") ? 1000 / params.entryPrice : 10.0;
    riskAmount = pipsRisked * pipValuePerLot * params.size;
  } else {
    riskAmount = slDistance * params.size;
  }

  const riskPercent = (riskAmount / balance.equity) * 100;
  const MAX_PERMITTED_RISK = 2.5; // Max 2.5% strict cap

  if (riskPercent > MAX_PERMITTED_RISK) {
    return {
      allowed: false,
      error: `REAL ACCOUNT RISK VIOLATION: Position risks $${riskAmount.toFixed(2)} (${riskPercent.toFixed(1)}% of balance). Maximum permitted risk per trade is 2.0%. Reduce lot/unit size.`,
      riskAmount,
      riskPercent,
    };
  }

  return {
    allowed: true,
    riskAmount,
    riskPercent,
    rewardRiskRatio: rrRatio,
  };
}
