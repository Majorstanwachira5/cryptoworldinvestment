"use client";

import React, { useState } from "react";
import { PredictionResult, MarketAsset, AccountType } from "@/types";
import {
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Target,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface PredictionPanelProps {
  prediction: PredictionResult | null;
  loading: boolean;
  onRefresh: () => void;
  onApplyPrediction: (pred: PredictionResult) => void;
  onAutoExecute?: (pred: PredictionResult) => void;
  asset: MarketAsset;
  accountType: AccountType;
}

export const PredictionPanel: React.FC<PredictionPanelProps> = ({
  prediction,
  loading,
  onRefresh,
  onApplyPrediction,
  onAutoExecute,
  accountType,
}) => {
  const [applied, setApplied] = useState(false);
  const [autoExecuting, setAutoExecuting] = useState(false);

  const handleApply = () => {
    if (!prediction) return;
    onApplyPrediction(prediction);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const handleInstantAutoExecute = async () => {
    if (!prediction || !onAutoExecute) return;
    setAutoExecuting(true);
    await onAutoExecute(prediction);
    setAutoExecuting(false);
  };

  const isLong = prediction?.direction === "LONG";

  return (
    <div className="bg-[#101726] border border-slate-800 rounded-xl p-4 relative overflow-hidden">
      {/* Glow Top Accent */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isLong
            ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
            : "bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500"
        }`}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-white tracking-wide">
                QUANT PREDICTION ENGINE
              </h3>
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {accountType} • MANDATORY STOP + 2.0% RISK CAP
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Algorithmic Technical Signal Pipeline — win rate is measured, never assumed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold bg-cyan-500 text-slate-950"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Signal
          </button>
        </div>
      </div>

      {prediction && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {/* Direction & Confidence */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Model Direction
            </span>
            <div className="flex items-center justify-between my-1">
              <div
                className={`flex items-center gap-1.5 font-black text-xl tracking-tight ${
                  isLong ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {isLong ? (
                  <ArrowUpRight className="w-6 h-6 stroke-[3]" />
                ) : (
                  <ArrowDownRight className="w-6 h-6 stroke-[3]" />
                )}
                <span>{prediction.direction}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-medium">Replay Win Rate</span>
                <span className="text-xs font-bold text-emerald-400">{prediction.winRateEstimate}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold mb-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-cyan-400" />
                  Confidence
                </span>
                <span className="text-cyan-400 font-bold">{prediction.confidence}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isLong
                      ? "bg-gradient-to-r from-teal-500 to-emerald-400"
                      : "bg-gradient-to-r from-amber-500 to-rose-500"
                  }`}
                  style={{ width: `${prediction.confidence}%` }}
                />
              </div>
            </div>
          </div>

          {/* Setup Parameters */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Setup Parameters
              </span>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                R:R {prediction.riskRewardRatio}
              </span>
            </div>

            <div className="space-y-1.5 my-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Entry
                </span>
                <span className="font-bold text-white">${prediction.entryPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Take Profit (TP)
                </span>
                <span className="font-bold text-emerald-400">${prediction.takeProfit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Stop Loss (SL)
                </span>
                <span className="font-bold text-rose-400">${prediction.stopLoss}</span>
              </div>
            </div>
          </div>

          {/* Indicators Breakdown */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Indicator Metrics
            </span>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">RSI (14):</span>
                <span className="font-semibold text-slate-200">
                  {prediction.indicators.rsi} ({prediction.indicators.rsiSignal})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MACD Cross:</span>
                <span className="font-semibold text-emerald-400">
                  {prediction.indicators.macd.cross.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">EMA Trend:</span>
                <span className="font-semibold text-cyan-400">
                  {prediction.indicators.emaTrend.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rationale and Execute Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 mt-3">
        <p className="text-[11px] text-slate-300 flex-1 leading-relaxed">
          <span className="font-bold text-cyan-400">Strategy Rationale: </span>
          {prediction?.rationale}
        </p>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Instant Auto-Execute One-Click Button */}
          {onAutoExecute && (
            <button
              onClick={handleInstantAutoExecute}
              disabled={autoExecuting || loading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2 rounded-lg text-xs tracking-wide transition-all active:scale-95 whitespace-nowrap"
              title="1-Click: Generates and immediately executes trade into REAL positions"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              {autoExecuting ? "Executing..." : "Auto-Predict & Execute"}
            </button>
          )}

          {/* Auto-Fill Button */}
          <button
            onClick={handleApply}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 font-bold px-3 py-2 rounded-lg text-xs tracking-wide transition-all active:scale-95 border whitespace-nowrap ${
              applied
                ? "bg-slate-800 border-emerald-500 text-emerald-400"
                : "bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200"
            }`}
          >
            {applied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Auto-Filled!
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Fill Ticket
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
