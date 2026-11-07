"use client";

import React, { useState, useEffect } from "react";
import {
  MarketAsset,
  TradeDirection,
  OrderType,
  Balance,
  PredictionResult,
  AccountType,
} from "@/types";
import {
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Sliders,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { calculateOptimalPositionSize, getPipSize } from "@/lib/trading/pips";

interface TradeTicketProps {
  asset: MarketAsset;
  balance: Balance | null;
  accountType: AccountType;
  onExecuteTrade: (tradeParams: {
    accountType: AccountType;
    symbol: string;
    assetClass: "CRYPTO" | "FOREX";
    direction: TradeDirection;
    orderType: OrderType;
    size: number;
    leverage: number;
    currentPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    rationale?: string;
  }) => Promise<boolean>;
  prefilledPrediction?: PredictionResult | null;
}

export const TradeTicket: React.FC<TradeTicketProps> = ({
  asset,
  balance,
  accountType,
  onExecuteTrade,
  prefilledPrediction,
}) => {
  const [direction, setDirection] = useState<TradeDirection>("LONG");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [size, setSize] = useState<string>(asset.assetClass === "FOREX" ? "1.0" : "0.5");
  const [leverage, setLeverage] = useState<number>(20);
  const [stopLoss, setStopLoss] = useState<string>("");
  const [takeProfit, setTakeProfit] = useState<string>("");
  const [riskPercent, setRiskPercent] = useState<number>(2); // 2% default risk
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmRealOpen, setConfirmRealOpen] = useState(false);

  const isReal = accountType === "REAL";

  // Apply prefilled prediction if passed
  useEffect(() => {
    if (prefilledPrediction) {
      setDirection(prefilledPrediction.direction);
      setStopLoss(prefilledPrediction.stopLoss.toString());
      setTakeProfit(prefilledPrediction.takeProfit.toString());

      const userBalance = balance?.availableBalance ?? 0;
      const opt = calculateOptimalPositionSize(
        userBalance,
        riskPercent,
        asset.currentPrice,
        prefilledPrediction.stopLoss,
        asset.assetClass,
        asset.symbol
      );
      setSize(opt.size.toString());
    }
  }, [prefilledPrediction, asset, balance, riskPercent, isReal]);

  // Adjust default size when asset changes
  useEffect(() => {
    if (asset.assetClass === "FOREX") {
      setSize(isReal ? "0.2" : "0.5");
    } else if (asset.symbol.includes("BTC")) {
      setSize(isReal ? "0.05" : "0.25");
    } else if (asset.symbol.includes("ETH")) {
      setSize(isReal ? "0.5" : "1.5");
    } else if (asset.symbol.includes("SOL")) {
      setSize(isReal ? "5.0" : "15.0");
    } else {
      setSize(isReal ? "0.1" : "0.5");
    }
  }, [asset.symbol, asset.assetClass, isReal]);

  const numericSize = parseFloat(size) || 0;
  const numericSL = parseFloat(stopLoss) || 0;
  const numericTP = parseFloat(takeProfit) || 0;

  const slDistance = numericSL > 0 ? Math.abs(asset.currentPrice - numericSL) : 0;
  const tpDistance = numericTP > 0 ? Math.abs(asset.currentPrice - numericTP) : 0;
  const rewardRiskRatio = slDistance > 0 ? (tpDistance / slDistance).toFixed(2) : "0.00";

  // Margin Required
  const notional =
    asset.assetClass === "FOREX"
      ? numericSize * 100000 * (asset.symbol.includes("EUR") ? asset.currentPrice : 1.0)
      : numericSize * asset.currentPrice;
  const marginRequired = notional / leverage;

  // Risk Assistant: Auto calculate position size
  const handleAutoRisk = (percent: number) => {
    setRiskPercent(percent);
    const userBalance = balance?.availableBalance ?? 0;

    let targetSL = numericSL;
    if (targetSL === 0) {
      const pipSize = getPipSize(asset.symbol, asset.assetClass);
      const defaultSlPips =
        asset.assetClass === "FOREX" ? 30 * pipSize : asset.currentPrice * 0.015;
      targetSL =
        direction === "LONG"
          ? asset.currentPrice - defaultSlPips
          : asset.currentPrice + defaultSlPips;
      setStopLoss(targetSL.toFixed(asset.digits));
    }

    const opt = calculateOptimalPositionSize(
      userBalance,
      percent,
      asset.currentPrice,
      targetSL,
      asset.assetClass,
      asset.symbol
    );
    setSize(opt.size.toString());
  };

  const handleExecute = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (numericSize <= 0) {
      setErrorMsg("Please enter a valid position size.");
      return;
    }

    if (isReal && (!numericSL || numericSL <= 0)) {
      setErrorMsg("REAL ACCOUNT MANDATORY: Stop Loss is required on all live trades.");
      return;
    }

    if (isReal && (!numericTP || parseFloat(rewardRiskRatio) < 1.45)) {
      setErrorMsg("REAL ACCOUNT MANDATORY: Minimum 1:1.5 Reward:Risk is required.");
      return;
    }

    if (isReal && !confirmRealOpen) {
      setConfirmRealOpen(true);
      return;
    }

    setConfirmRealOpen(false);
    setExecuting(true);

    const success = await onExecuteTrade({
      accountType,
      symbol: asset.symbol,
      assetClass: asset.assetClass,
      direction,
      orderType,
      size: numericSize,
      leverage,
      currentPrice: asset.currentPrice,
      stopLoss: numericSL > 0 ? numericSL : undefined,
      takeProfit: numericTP > 0 ? numericTP : undefined,
      rationale: prefilledPrediction ? prefilledPrediction.rationale : undefined,
    });

    setExecuting(false);
    if (success) {
      setSuccessMsg(`Executed ${direction} ${numericSize} ${asset.symbol} in ${accountType}!`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg("Execution failed. Verify balance and risk parameters.");
    }
  };

  return (
    <div
      className={`border rounded-xl p-4 flex flex-col justify-between transition-colors ${
        isReal
          ? "bg-[#111726] border-emerald-500/40"
          : "bg-[#0f1422] border-slate-800"
      }`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Sliders className={`w-4 h-4 ${isReal ? "text-emerald-400" : "text-cyan-400"}`} />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-white">
              {accountType} TRADE TICKET
            </h3>
          </div>
          <span
            className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${
              isReal
                ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                : "bg-cyan-950 text-cyan-300 border-cyan-800"
            }`}
          >
            {isReal ? "LIVE CAPITAL" : "VIRTUAL FUNDS"}
          </span>
        </div>

        {/* Direction Switcher */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setDirection("LONG")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-black text-xs transition-all ${
              direction === "LONG"
                ? "bg-emerald-500 text-slate-950"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            BUY / LONG
          </button>
          <button
            onClick={() => setDirection("SHORT")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-black text-xs transition-all ${
              direction === "SHORT"
                ? "bg-rose-500 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            SELL / SHORT
          </button>
        </div>

        {/* Order Type */}
        <div className="flex bg-slate-900 rounded-lg p-1 mb-3 border border-slate-800">
          {(["MARKET", "LIMIT"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`flex-1 text-[11px] font-bold py-1 rounded-md transition-all ${
                orderType === type
                  ? "bg-slate-800 text-cyan-400"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Risk Assistant Presets */}
        <div
          className={`mb-3 border rounded-lg p-2.5 ${
            isReal ? "bg-emerald-950/20 border-emerald-500/30" : "bg-slate-900/90 border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 text-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Risk Model Cap
            </span>
            <span className="text-cyan-400 font-bold">
              {isReal ? "Max 2.0% Enforced" : "Preset Risk %"}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[1, 1.5, 2, isReal ? 2.5 : 5].map((pct) => (
              <button
                key={pct}
                onClick={() => handleAutoRisk(pct)}
                className={`text-[10px] font-bold py-1 rounded border transition-all ${
                  riskPercent === pct
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Size Input */}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] font-medium text-slate-400 mb-1">
            <span>Size ({asset.assetClass === "FOREX" ? "Lots" : "Units"})</span>
            <span>≈ ${(notional).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <input
            type="number"
            step={asset.assetClass === "FOREX" ? "0.1" : "0.01"}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Leverage Slider */}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] font-medium text-slate-400 mb-1">
            <span>Leverage</span>
            <span className="text-cyan-400 font-bold">{leverage}x</span>
          </div>
          <input
            type="range"
            min="1"
            max={isReal ? 50 : 100}
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-500 mt-1">
            <span>1x</span>
            <span>20x</span>
            <span>{isReal ? "50x (Max)" : "100x"}</span>
          </div>
        </div>

        {/* Stop Loss & Take Profit */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <span className="text-[10px] font-bold text-rose-400 flex items-center justify-between mb-1">
              <span>Stop Loss ($)</span>
              {isReal && <span className="text-[9px] text-rose-500 font-black">MANDATORY</span>}
            </span>
            <input
              type="number"
              step="any"
              placeholder="e.g. 63000"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-rose-400"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-400 flex items-center justify-between mb-1">
              <span>Take Profit ($)</span>
              {isReal && <span className="text-[9px] text-emerald-500 font-black">$\ge 1:1.5$</span>}
            </span>
            <input
              type="number"
              step="any"
              placeholder="e.g. 66000"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        {/* Ticket Summary & R:R */}
        <div className="bg-slate-900/60 rounded-lg p-2.5 space-y-1 text-[11px] text-slate-400 mb-3 border border-slate-800/60">
          <div className="flex justify-between">
            <span>Required Margin:</span>
            <span className="font-semibold text-white">
              ${marginRequired.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Risk/Reward Ratio:</span>
            <span
              className={`font-bold ${
                parseFloat(rewardRiskRatio) >= 1.5 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              1:{rewardRiskRatio}
            </span>
          </div>
        </div>

        {/* Errors & Alerts */}
        {errorMsg && (
          <div className="flex items-start gap-1.5 text-xs text-rose-400 bg-rose-950/60 border border-rose-800/80 p-2 rounded-lg mb-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 p-2 rounded-lg mb-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {confirmRealOpen && (
          <div className="bg-amber-950/70 border border-amber-500/50 p-3 rounded-lg mb-2 text-xs space-y-2 animate-fade-in">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Confirm Real Capital Execution
            </div>
            <p className="text-[11px] text-amber-200">
              You are risking live capital on {asset.symbol} with mandatory SL at ${stopLoss}. Confirm execution?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleExecute}
                className="flex-1 py-1 rounded bg-amber-500 text-slate-950 font-bold"
              >
                Yes, Place Real Order
              </button>
              <button
                onClick={() => setConfirmRealOpen(false)}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Execution Button */}
      <button
        onClick={handleExecute}
        disabled={executing}
        className={`w-full py-3 rounded-lg font-black text-xs tracking-wider uppercase transition-all active:scale-95 ${
          direction === "LONG"
            ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
            : "bg-rose-500 hover:bg-rose-400 text-white"
        }`}
      >
        {executing ? (
          "Executing Order..."
        ) : (
          `Place ${accountType} ${direction} Order (${leverage}x)`
        )}
      </button>
    </div>
  );
};
