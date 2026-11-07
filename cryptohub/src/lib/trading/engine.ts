import { db } from "@/lib/db";
import { Trade, AssetClass, TradeDirection, OrderType, AccountType } from "@/types";
import { validateTradeRisk } from "./riskEngine";

export interface ExecuteOrderParams {
  userId: string;
  accountType?: AccountType;
  symbol: string;
  assetClass: AssetClass;
  direction: TradeDirection;
  orderType: OrderType;
  size: number;
  leverage: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  rationale?: string;
}

export function executeOrder(params: ExecuteOrderParams): {
  success: boolean;
  trade?: Trade;
  error?: string;
} {
  const accountType: AccountType = "REAL";

  // 1. Enforce strict risk rules on REAL accounts
  const riskCheck = validateTradeRisk(params.userId, {
    accountType,
    symbol: params.symbol,
    assetClass: params.assetClass,
    direction: params.direction,
    size: params.size,
    entryPrice: params.currentPrice,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    leverage: params.leverage,
  });

  if (!riskCheck.allowed) {
    return {
      success: false,
      error: riskCheck.error,
    };
  }

  const balance = db.getBalance(params.userId, accountType);

  // 2. Calculate Required Margin
  const notionalValue =
    params.assetClass === "FOREX"
      ? params.size * 100000 * (params.symbol.includes("EUR") ? params.currentPrice : 1.0)
      : params.size * params.currentPrice;

  const requiredMargin = notionalValue / params.leverage;

  // 3. Validate Free Margin
  if (requiredMargin > balance.freeMargin) {
    return {
      success: false,
      error: `Insufficient free margin in ${accountType} account. Required: $${requiredMargin.toFixed(2)}, Available: $${balance.freeMargin.toFixed(2)}`,
    };
  }

  // 4. Calculate Liquidation Price
  const maintenanceBuffer = 0.9;
  const liqDistance = params.currentPrice * (1 / params.leverage) * maintenanceBuffer;
  const liquidationPrice =
    params.direction === "LONG"
      ? Math.max(0, params.currentPrice - liqDistance)
      : params.currentPrice + liqDistance;

  // 4b. Enforce strictly correct Take Profit & Stop Loss orientation
  const isForex = params.assetClass === "FOREX";
  const digits = isForex ? (params.symbol.includes("JPY") ? 3 : 5) : 2;
  let finalTP = params.takeProfit;
  let finalSL = params.stopLoss;

  if (params.direction === "LONG") {
    if (finalTP && finalTP <= params.currentPrice) {
      const dist = Math.abs(params.currentPrice - finalTP);
      finalTP = Number((params.currentPrice + (dist > 0 ? dist : params.currentPrice * 0.035)).toFixed(digits));
    }
    if (finalSL && finalSL >= params.currentPrice) {
      const dist = Math.abs(finalSL - params.currentPrice);
      finalSL = Number((params.currentPrice - (dist > 0 ? dist : params.currentPrice * 0.015)).toFixed(digits));
    }
  } else {
    if (finalTP && finalTP >= params.currentPrice) {
      const dist = Math.abs(finalTP - params.currentPrice);
      finalTP = Number((params.currentPrice - (dist > 0 ? dist : params.currentPrice * 0.035)).toFixed(digits));
    }
    if (finalSL && finalSL <= params.currentPrice) {
      const dist = Math.abs(params.currentPrice - finalSL);
      finalSL = Number((params.currentPrice + (dist > 0 ? dist : params.currentPrice * 0.015)).toFixed(digits));
    }
  }

  // 5. Record Trade in Isolated Account
  const newTrade = db.addTrade(
    params.userId,
    {
      accountType,
      symbol: params.symbol,
      assetClass: params.assetClass,
      direction: params.direction,
      orderType: params.orderType,
      entryPrice: params.currentPrice,
      currentPrice: params.currentPrice,
      size: params.size,
      leverage: params.leverage,
      margin: Math.round(requiredMargin * 100) / 100,
      stopLoss: finalSL,
      takeProfit: finalTP,
      liquidationPrice: Number(liquidationPrice.toFixed(params.assetClass === "FOREX" ? 5 : 2)),
      rationale:
        params.rationale || "Real Capital Strict Ticket Execution",
    },
    accountType
  );

  return {
    success: true,
    trade: newTrade,
  };
}

export function closeOrder(
  userId: string,
  tradeId: string,
  exitPrice: number,
  accountType: AccountType = "REAL"
): {
  success: boolean;
  trade?: Trade;
  error?: string;
} {
  // Scoped to the caller, so one user can never close another's position.
  const closed = db.closeTrade(userId, tradeId, exitPrice, accountType);
  if (!closed) {
    return { success: false, error: "Trade not found or already closed." };
  }
  return { success: true, trade: closed };
}
