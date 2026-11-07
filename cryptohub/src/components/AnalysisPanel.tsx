"use client";

import React, { useMemo, useState } from "react";
import { AnalysisReport, IndicatorSignal, PredictionResult } from "@/types";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Gauge,
  Layers,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Waves,
} from "lucide-react";

interface AnalysisPanelProps {
  report: AnalysisReport | null;
  loading: boolean;
  onRefresh: () => void;
  onApplySetup: (prediction: PredictionResult) => void;
}

type Tab = "SIGNALS" | "SETUP" | "REPLAY";

const BIAS_STYLES: Record<string, { text: string; chip: string; bar: string }> = {
  BULLISH: {
    text: "text-emerald-400",
    chip: "bg-emerald-950/70 border-emerald-700/70 text-emerald-300",
    bar: "bg-gradient-to-r from-teal-500 to-emerald-400",
  },
  BEARISH: {
    text: "text-rose-400",
    chip: "bg-rose-950/70 border-rose-700/70 text-rose-300",
    bar: "bg-gradient-to-r from-amber-500 to-rose-500",
  },
  NEUTRAL: {
    text: "text-slate-300",
    chip: "bg-slate-800/70 border-slate-600/70 text-slate-300",
    bar: "bg-gradient-to-r from-slate-500 to-slate-300",
  },
};

const VERDICT_LABEL: Record<AnalysisReport["verdict"], string> = {
  STRONG_LONG: "Strong Long",
  LEAN_LONG: "Lean Long",
  NEUTRAL: "No Trade",
  LEAN_SHORT: "Lean Short",
  STRONG_SHORT: "Strong Short",
};

function SignalRow({ signal }: { signal: IndicatorSignal }) {
  const [open, setOpen] = useState(false);
  const style = BIAS_STYLES[signal.bias];
  const magnitude = Math.min(1, Math.abs(signal.strength));
  const positive = signal.strength >= 0;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-100 truncate">{signal.label}</span>
            <span
              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${style.chip}`}
            >
              {signal.bias}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">{signal.value}</div>
        </div>

        <div className="w-24 shrink-0">
          <div className="w-full h-1.5 bg-slate-800 rounded-full relative overflow-hidden">
            <div className="absolute inset-y-0 left-1/2 w-px bg-slate-600" />
            <div
              className={`absolute inset-y-0 rounded-full ${style.bar}`}
              style={
                positive
                  ? { left: "50%", width: `${magnitude * 50}%` }
                  : { right: "50%", width: `${magnitude * 50}%` }
              }
            />
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="px-3 pb-2.5 pt-0 text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/70">
          {signal.detail}
          <span className="text-slate-600"> Weight {signal.weight.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
      <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${tone}`}>{value}</div>
    </div>
  );
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  report,
  loading,
  onRefresh,
  onApplySetup,
}) => {
  const [tab, setTab] = useState<Tab>("SIGNALS");

  const style = useMemo(
    () => BIAS_STYLES[report?.bias ?? "NEUTRAL"],
    [report?.bias]
  );

  if (!report) {
    return (
      <div className="bg-gradient-to-b from-[#101726] to-[#0c111c] border border-cyan-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Activity className="w-4 h-4 animate-pulse text-cyan-400" />
          {loading ? "Running analysis engine…" : "No analysis available."}
        </div>
      </div>
    );
  }

  const digits = report.digits;
  const isLong = report.bias === "BULLISH";
  const setup = report.setup;
  const bt = report.backtest;
  const perf = report.performance;

  const handleApplySetup = () => {
    if (!setup) return;
    onApplySetup({
      id: `analysis_${Date.now()}`,
      symbol: report.symbol,
      assetClass: report.assetClass,
      timeframe: report.timeframe,
      direction: setup.direction,
      confidence: report.confidence,
      entryPrice: setup.entry,
      takeProfit: setup.takeProfit,
      stopLoss: setup.stopLoss,
      riskRewardRatio: `1:${setup.riskRewardRatio.toFixed(1)}`,
      // Reported straight from the replay sample, never asserted as a promise.
      winRateEstimate: bt && bt.totalTrades > 0 ? `${bt.winRate}%` : "n/a",
      indicators: {
        rsi: Number(report.signals.find((s) => s.id === "rsi")?.value ?? 50),
        rsiSignal:
          (report.signals.find((s) => s.id === "rsi")?.bias === "BULLISH"
            ? "OVERSOLD"
            : report.signals.find((s) => s.id === "rsi")?.bias === "BEARISH"
              ? "OVERBOUGHT"
              : "NEUTRAL") as "OVERSOLD" | "OVERBOUGHT" | "NEUTRAL",
        macd: {
          macdLine: 0,
          signalLine: 0,
          histogram: Number(report.signals.find((s) => s.id === "macd")?.strength ?? 0),
          cross: "NEUTRAL" as const,
        },
        ema50: report.trend.ema50,
        ema200: report.trend.ema200,
        emaTrend:
          report.trend.ema50 > report.trend.ema200 ? "GOLDEN_ALIGNMENT" : "DEATH_ALIGNMENT",
      },
      rationale: `Analysis Engine: ${VERDICT_LABEL[report.verdict]} on ${report.timeframe} with ${report.confidence}% confidence and ${report.agreement}% signal agreement. ${report.notes[0] ?? ""}`,
      createdAt: report.generatedAt,
    });
  };

  return (
    <div className="bg-[#101726] border border-slate-800 rounded-xl p-4 relative overflow-hidden">
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isLong
            ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
            : report.bias === "BEARISH"
              ? "bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500"
              : "bg-gradient-to-r from-slate-600 via-slate-400 to-slate-500"
        }`}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-white tracking-wide">
                ANALYSIS ENGINE
              </h3>
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border bg-emerald-950/80 text-emerald-400 border-emerald-700/80">
                {report.accountType}
              </span>
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800/70 text-slate-400 border border-slate-700/70">
                {report.timeframe}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {report.symbol} @ {report.price} — indicators, structure and measured history
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          {(["SIGNALS", "SETUP", "REPLAY"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                tab === t ? "bg-cyan-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-slate-400 hover:text-cyan-400 p-1 rounded hover:bg-slate-800"
            title="Re-run analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {tab === "SIGNALS" && (
        <div className="space-y-3">
          {/* Verdict */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
              <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                Verdict
              </div>
              <div className={`flex items-center gap-1.5 font-black text-lg mt-1 ${style.text}`}>
                {isLong ? (
                  <TrendingUp className="w-5 h-5" />
                ) : report.bias === "BEARISH" ? (
                  <TrendingDown className="w-5 h-5" />
                ) : (
                  <Waves className="w-5 h-5" />
                )}
                {VERDICT_LABEL[report.verdict]}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Bias: {report.bias} · score {report.confluenceScore > 0 ? "+" : ""}
                {report.confluenceScore}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
              <div className="flex justify-between text-[11px] font-semibold mb-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-cyan-400" /> Confidence
                </span>
                <span className="text-cyan-400 font-bold">{report.confidence}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${style.bar}`}
                  style={{ width: `${report.confidence}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>{report.agreement}% of weight agrees</span>
                <span>30% floor for sizing</span>
              </div>
            </div>

            <Stat
              label="Trend Regime"
              value={`${report.trend.regime} · ADX ${report.trend.adx}`}
              tone="text-cyan-400"
            />
            <Stat
              label="Volatility"
              value={`${report.volatility.regime} · ATR ${report.volatility.atrPercent}%`}
              tone={
                report.volatility.regime === "EXTREME"
                  ? "text-rose-400"
                  : report.volatility.regime === "COMPRESSED"
                    ? "text-amber-400"
                    : "text-slate-200"
              }
            />
          </div>

          {/* Multi-timeframe */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
              Multi-Timeframe Confluence
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {report.multiTimeframe.map((tf) => {
                const s = BIAS_STYLES[tf.bias];
                const isPrimary = tf.timeframe === report.timeframe;
                return (
                  <div
                    key={tf.timeframe}
                    className={`rounded-md border px-2 py-1.5 text-center ${
                      isPrimary ? "border-cyan-500/60 bg-cyan-950/40" : "border-slate-800 bg-slate-900/60"
                    }`}
                  >
                    <div className="text-[10px] font-bold text-slate-200">{tf.timeframe}</div>
                    <div className={`text-[9px] font-black ${s.text}`}>{tf.bias}</div>
                    <div className="text-[9px] text-slate-500 font-mono">
                      {tf.score > 0 ? "+" : ""}
                      {tf.score}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Signals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {report.signals.map((signal) => (
              <SignalRow key={signal.id} signal={signal} />
            ))}
          </div>

          {/* Levels */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
              Support / Resistance
            </div>
            {report.levels.length === 0 ? (
              <div className="text-[11px] text-slate-500">
                No clean swing pivots in this window — structure is undecided.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {report.levels.slice(0, 10).map((level, i) => {
                  const above = level.price > report.price;
                  return (
                    <div
                      key={`${level.kind}-${i}`}
                      className={`rounded-md border px-2 py-1 text-[10px] font-mono ${
                        above
                          ? "border-rose-800/60 bg-rose-950/40 text-rose-300"
                          : "border-emerald-800/60 bg-emerald-950/40 text-emerald-300"
                      }`}
                    >
                      {above ? "R" : "S"} {level.price.toFixed(digits)} · {level.touches}x{" "}
                      {level.strength}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "SETUP" && (
        <div className="space-y-3">
          {setup ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat
                  label="Direction"
                  value={setup.direction}
                  tone={setup.direction === "LONG" ? "text-emerald-400" : "text-rose-400"}
                />
                <Stat label="Entry" value={setup.entry.toFixed(digits)} />
                <Stat label="Stop Loss" value={setup.stopLoss.toFixed(digits)} tone="text-rose-400" />
                <Stat
                  label="Take Profit"
                  value={setup.takeProfit.toFixed(digits)}
                  tone="text-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat
                  label={`Size (${setup.sizeUnit})`}
                  value={setup.size.toString()}
                  tone="text-cyan-400"
                />
                <Stat
                  label={`Risk ${setup.riskPercent}%`}
                  value={`$${setup.riskAmount.toFixed(2)}`}
                  tone="text-amber-400"
                />
                <Stat
                  label={`Reward 1:${setup.riskRewardRatio.toFixed(1)}`}
                  value={`$${setup.rewardAmount.toFixed(2)}`}
                  tone="text-emerald-400"
                />
                <Stat
                  label={`Margin @${setup.leverage}x`}
                  value={`$${setup.marginRequired.toFixed(2)}`}
                />
              </div>

              {setup.warnings.length > 0 && (
                <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg p-2.5 space-y-1">
                  {setup.warnings.map((w) => (
                    <div key={w} className="flex items-start gap-1.5 text-[11px] text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleApplySetup}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-4 py-2 rounded-lg text-xs tracking-wide transition-all active:scale-[0.99]"
              >
                <Target className="w-3.5 h-3.5 inline mr-1" />
                Load This Setup Into The Ticket
              </button>
            </>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 text-center">
              <ShieldAlert className="w-6 h-6 text-slate-500 mx-auto" />
              <div className="text-sm font-bold text-slate-200 mt-1.5">No position offered</div>
              <p className="text-[11px] text-slate-400 mt-1">
                The engine will not size a trade when signals conflict, confidence is below the
                floor, or the account cannot support the risk. That restraint is the point.
              </p>
            </div>
          )}

          {perf && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                Your {report.accountType} Record — Realised Trades Only
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <Stat label="Closed" value={perf.closedTrades.toString()} />
                <Stat
                  label="Win Rate"
                  value={perf.winRate === null ? "—" : `${perf.winRate}%`}
                  tone={(perf.winRate ?? 0) >= 50 ? "text-emerald-400" : "text-rose-400"}
                />
                <Stat
                  label="Net PnL"
                  value={`${perf.netPnl >= 0 ? "+" : ""}$${perf.netPnl.toFixed(2)}`}
                  tone={perf.netPnl >= 0 ? "text-emerald-400" : "text-rose-400"}
                />
                <Stat
                  label="Profit Factor"
                  value={perf.profitFactor === null ? "n/a" : perf.profitFactor.toFixed(2)}
                />
                <Stat label="Max DD" value={`$${perf.maxDrawdown.toFixed(2)}`} tone="text-amber-400" />
                <Stat label="W / L" value={`${perf.wins} / ${perf.losses}`} />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "REPLAY" && (
        <div className="space-y-3">
          {bt && bt.totalTrades > 0 ? (
            <>
              <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-lg p-2.5 flex items-start gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-indigo-200 leading-relaxed">
                  <strong>Measured, not promised.</strong> These numbers come from replaying this
                  exact rule set over {bt.timeframes.join(" / ")} history. They describe the past of
                  one rule set on one series — they are not a forecast for the next trade.
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <Stat
                  label="Trades"
                  value={bt.totalTrades.toString()}
                />
                <Stat
                  label="Win Rate"
                  value={bt.winRate === null ? "—" : `${bt.winRate}%`}
                  tone={(bt.winRate ?? 0) >= 50 ? "text-emerald-400" : "text-rose-400"}
                />
                <Stat
                  label="Net PnL"
                  value={`${bt.netPnlPercent >= 0 ? "+" : ""}${bt.netPnlPercent}%`}
                  tone={bt.netPnlPercent >= 0 ? "text-emerald-400" : "text-rose-400"}
                />
                <Stat
                  label="Profit Factor"
                  value={bt.profitFactor === null ? "n/a" : bt.profitFactor.toFixed(2)}
                />
                <Stat
                  label="Expectancy"
                  value={`${bt.expectancyPercent >= 0 ? "+" : ""}${bt.expectancyPercent}%`}
                />
                <Stat
                  label="Max DD"
                  value={`${bt.maxDrawdownPercent}%`}
                  tone="text-amber-400"
                />
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                  Per Timeframe
                </div>
                <div className="space-y-1.5">
                  {Object.entries(bt.perTimeframe).map(([tf, stats]) => (
                    <div key={tf} className="flex items-center gap-2 text-[11px]">
                      <span className="w-8 font-bold text-slate-300">{tf}</span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${style.bar}`}
                          style={{ width: `${Math.min(100, stats.winRate ?? 0)}%` }}
                        />
                      </div>
                      <span className="w-32 text-right font-mono text-slate-400">
                        {stats.winRate}% · {stats.trades} trades ·{" "}
                        {stats.netPnlPercent >= 0 ? "+" : ""}
                        {stats.netPnlPercent}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Stat label="Long Win Rate" value={`${bt.longWinRate}%`} />
                  <Stat label="Short Win Rate" value={`${bt.shortWinRate}%`} />
                  <Stat label="Avg Win" value={`+${bt.averageWinPercent}%`} tone="text-emerald-400" />
                  <Stat label="Avg Loss" value={`-${bt.averageLossPercent}%`} tone="text-rose-400" />
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                  Strategy & Methodology
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{bt.strategy}</p>
                <p className="text-[10px] text-slate-500 leading-relaxed">{bt.methodology}</p>
                <p className="text-[10px] text-amber-400/80 leading-relaxed italic">
                  {bt.disclaimer}
                </p>
              </div>
            </>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 text-center text-[11px] text-slate-400">
              Not enough replayed trades to report statistics for this symbol yet.
            </div>
          )}

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
              What This Report Says
            </div>
            <ul className="space-y-1">
              {report.notes.map((note, i) => (
                <li key={i} className="text-[11px] text-slate-300 leading-relaxed flex gap-1.5">
                  <span className="text-cyan-500 shrink-0">›</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};