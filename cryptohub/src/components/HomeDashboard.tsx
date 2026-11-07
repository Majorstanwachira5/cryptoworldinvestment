"use client";

import React, { useState, useEffect } from "react";
import {
  Balance,
  User,
  Trade,
  ReferralStats,
  MarketAsset,
  AccountType,
  ProfileSummary,
} from "@/types";
import { DisplayCurrency, formatMoney, formatSignedMoney } from "@/lib/fx/rates";
import { authFetch } from "@/lib/auth/session";
import {
  TrendingUp,
  Gift,
  ArrowRight,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
  ArrowDownToLine,
  Check,
  Copy,
  ChevronRight,
  Award,
} from "lucide-react";

interface HomeDashboardProps {
  user: User | null;
  balance: Balance | null;
  profile: ProfileSummary | null;
  referrals: ReferralStats | null;
  trades: Trade[];
  assets: MarketAsset[];
  accountType: AccountType;
  currency: DisplayCurrency;
  onNavigateToTrade: (accountType?: AccountType, asset?: MarketAsset) => void;
  onNavigateToReferrals: () => void;
  onNavigateToMike: () => void;
  onOpenDeposit: () => void;
  onCloseTrade: (tradeId: string, exitPrice: number) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
  balance,
  profile,
  referrals,
  trades,
  assets,
  currency,
  onNavigateToTrade,
  onNavigateToReferrals,
  onNavigateToMike,
  onOpenDeposit,
  onCloseTrade,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [levelInfo, setLevelInfo] = useState<{
    effectiveLevel: number;
    cumulativeDeposits: number;
    successfulReferralsCount: number;
    dailyEarningRange: [number, number] | null;
    eligibleForAutoTrade: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    authFetch("/api/rewards/levels")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.success) {
          setLevelInfo({
            effectiveLevel: d.effectiveLevel ?? 0,
            cumulativeDeposits: d.cumulativeDeposits ?? 0,
            successfulReferralsCount: d.successfulReferralsCount ?? 0,
            dailyEarningRange: d.dailyEarningRange ?? null,
            eligibleForAutoTrade: Boolean(d.eligibleForAutoTrade),
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [balance?.availableBalance]);

  const realBal = profile?.real ?? balance;
  const realAvailable = realBal?.availableBalance ?? 0;
  const realEquity = realBal?.equity ?? 0;
  const realDeposited = realBal?.totalDeposited ?? 0;

  const activeTrades = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status === "CLOSED");

  const totalClosed = closedTrades.length;
  const winningTrades = closedTrades.filter((t) => t.pnl > 0).length;
  const winRate = totalClosed > 0 ? (winningTrades / totalClosed) * 100 : 0;
  const netRealizedPnl = closedTrades.reduce((acc, t) => acc + t.pnl, 0);

  const copyReferralCode = async () => {
    if (!referrals?.code) return;
    try {
      await navigator.clipboard.writeText(referrals.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-3.5 w-full mx-auto pb-8">
      {/* 1. Welcome & Account Greeting Card */}
      <div className="bg-gradient-to-r from-[#101726] via-[#121c2e] to-[#0c111c] border border-slate-800 rounded-xl p-4 sm:p-5 relative overflow-hidden">
        {/* Subtle Luxury Gold Top Accent Hairline */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Institutional Live Trading Engine Online
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Welcome back, <span className="text-cyan-400">{user?.name || "Trader"}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              REAL-only TRC20 USDT double-entry ledger active. Monitor your portfolio and execute orders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase bg-gradient-to-r from-amber-950/90 via-yellow-950/60 to-amber-950/90 text-amber-300 border border-amber-500/50 flex items-center gap-1.5 shadow-sm">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              {levelInfo && levelInfo.effectiveLevel > 0
                ? `Level ${levelInfo.effectiveLevel} • Gold ($${levelInfo.dailyEarningRange?.[0]}–$${levelInfo.dailyEarningRange?.[1]}/day)`
                : "Institutional Gold (<$300 Deposit)"}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              KYC {user?.kycStatus || "VERIFIED"}
            </span>
          </div>
        </div>

        {/* Quick Action Navigation Bar — 4 Balanced Mobile/Desktop Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => onNavigateToTrade("REAL")}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-black py-2.5 px-3 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-emerald-500/20"
          >
            <span>Trade Live</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onOpenDeposit}
            className="flex items-center justify-center gap-2 bg-slate-800/90 hover:bg-slate-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all active:scale-95 border border-slate-700"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
            <span>Deposit USDT</span>
          </button>
          <button
            onClick={onNavigateToReferrals}
            className="flex items-center justify-center gap-2 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 font-bold py-2.5 px-3 rounded-xl text-xs transition-all active:scale-95 border border-amber-700/50"
          >
            <Gift className="w-3.5 h-3.5 text-amber-400" />
            <span>Invite ($30 USDT)</span>
          </button>
          <button
            onClick={onNavigateToMike}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-900/60 to-purple-900/60 hover:from-indigo-800/70 hover:to-purple-800/70 text-cyan-300 font-bold py-2.5 px-3 rounded-xl text-xs transition-all active:scale-95 border border-indigo-700/50"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ask Mike AI</span>
          </button>
        </div>
      </div>

      {/* 2. Account Balance & Level Status (REAL only) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Real Account Balance Card */}
        <div className="lg:col-span-7 bg-[#111724] border border-emerald-900/40 hover:border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-lg transition-colors relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm text-white">REAL LIVE ACCOUNT</h3>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black">
                    ★ GOLD
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold text-emerald-400">
                  TRC20 USDT Double-Entry Ledger
                </span>
              </div>
            </div>
            <button
              onClick={onOpenDeposit}
              className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-black transition-all shadow"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Deposit / Withdraw
            </button>
          </div>

          <div className="mb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Live Available Capital
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {formatMoney(realAvailable, currency)}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-xs">
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">Equity</span>
              <span className="font-bold text-emerald-400">{formatMoney(realEquity, currency)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">Total Deposited</span>
              <span className="font-bold text-slate-200">{formatMoney(realDeposited, currency)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">Free Margin</span>
              <span className="font-bold text-slate-200">
                {formatMoney(realBal?.freeMargin ?? realAvailable, currency)}
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigateToTrade("REAL")}
            className="w-full mt-4 bg-slate-800/80 hover:bg-slate-700 text-emerald-400 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <span>Open Live Trading Terminal</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Auto-Trade Level & Wednesday Bonus Card */}
        <div className="lg:col-span-5 bg-[#111724] border border-amber-900/40 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-950 border border-amber-700/60 flex items-center justify-center text-amber-400">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">AUTO-TRADE TIER</h3>
                  <span className="text-[10px] uppercase font-bold text-amber-400">
                    Server-Derived From Confirmed Deposits
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {levelInfo && levelInfo.effectiveLevel > 0 ? `LEVEL ${levelInfo.effectiveLevel}` : "UNRANKED"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400">Level 3 (≥$300 Deposit)</span>
                <span className="font-mono font-bold text-emerald-400">$5.00 – $8.00 / day</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400">Level 2 (≥$500 or L3 + &gt;10 Ref)</span>
                <span className="font-mono font-bold text-cyan-400">$8.00 – $14.00 / day</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400">Level 1 (≥$600 or L3 + &gt;20 Ref)</span>
                <span className="font-mono font-bold text-amber-400">$10.00 – $18.00 / day</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Wednesday Loyalty Bonus (L3–L1):</span>
            <span className="font-bold text-emerald-400">+$1.00 USDT / Wed</span>
          </div>
        </div>
      </div>

      {/* 3. Live Market Ticker Grid */}
      <div className="bg-[#111724] border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h3 className="font-extrabold text-xs sm:text-sm text-white uppercase tracking-wider">
              Live Market Tickers
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Tap any instrument to trade</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {assets.map((asset) => {
            const isPositive = asset.change24h >= 0;
            return (
              <button
                key={asset.symbol}
                onClick={() => onNavigateToTrade("REAL", asset)}
                className="bg-slate-950/70 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 p-2.5 rounded-xl text-left transition-all active:scale-95 group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold text-xs text-white group-hover:text-cyan-400 transition-colors">
                    {asset.symbol}
                  </span>
                  <span className="text-[9px] font-bold px-1 rounded bg-slate-800 text-slate-400">
                    {asset.assetClass}
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-200">
                  ${asset.currentPrice.toLocaleString("en-US", {
                    minimumFractionDigits: asset.digits,
                    maximumFractionDigits: asset.digits,
                  })}
                </div>
                <div
                  className={`text-[10px] font-semibold flex items-center mt-0.5 ${
                    isPositive ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {asset.change24h.toFixed(2)}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Active Trading Positions & Realised Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Active Positions Card */}
        <div className="lg:col-span-7 bg-[#111724] border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="font-extrabold text-xs sm:text-sm text-white uppercase tracking-wider">
                  Open Positions (REAL)
                </h3>
              </div>
              <button
                onClick={() => onNavigateToTrade("REAL")}
                className="text-xs text-cyan-400 hover:underline font-bold"
              >
                Manage All
              </button>
            </div>

            {activeTrades.length === 0 ? (
              <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                <Layers className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No open positions on REAL account.</p>
                <button
                  onClick={() => onNavigateToTrade("REAL")}
                  className="mt-3 inline-flex items-center gap-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                >
                  <span>Open New Trade</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {activeTrades.slice(0, 3).map((trade) => {
                  const isLong = trade.direction === "LONG";
                  const isProfit = trade.pnl >= 0;
                  return (
                    <div
                      key={trade.id}
                      className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                            isLong
                              ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                              : "bg-rose-950 text-rose-400 border-rose-800"
                          }`}
                        >
                          {trade.direction}
                        </span>
                        <div>
                          <div className="font-extrabold text-xs text-white">{trade.symbol}</div>
                          <div className="text-[10px] text-slate-500">
                            {trade.size} @ ${trade.entryPrice}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-black text-xs ${
                            isProfit ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatSignedMoney(trade.pnl, currency)}
                        </div>
                        <button
                          onClick={() => onCloseTrade(trade.id, trade.currentPrice)}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          Close Position
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {activeTrades.length > 3 && (
            <div className="mt-3 text-center text-xs text-slate-400">
              +{activeTrades.length - 3} more open position(s) in Trade terminal.
            </div>
          )}
        </div>

        {/* Realised Performance Card */}
        <div className="lg:col-span-5 bg-[#111724] border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="font-extrabold text-xs sm:text-sm text-white uppercase tracking-wider">
                Trading Record (REAL)
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] uppercase font-bold text-slate-500">Win Rate</span>
              <div
                className={`text-xl font-black mt-0.5 ${
                  winRate >= 50 ? "text-emerald-400" : "text-slate-300"
                }`}
              >
                {totalClosed > 0 ? `${winRate.toFixed(1)}%` : "—"}
              </div>
              <span className="text-[10px] text-slate-500">
                {winningTrades} wins / {totalClosed - winningTrades} losses
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] uppercase font-bold text-slate-500">Realised PnL</span>
              <div
                className={`text-xl font-black mt-0.5 ${
                  netRealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatSignedMoney(netRealizedPnl, currency)}
              </div>
              <span className="text-[10px] text-slate-500">Total {totalClosed} closed</span>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Risk Management Model:</span>
              <span className="font-bold text-white">Algorithmic Risk Governance</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Min Required Reward:Risk:</span>
              <span className="font-bold text-cyan-400">1:1.5</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Max Capital Risk Per Trade:</span>
              <span className="font-bold text-slate-200">2.0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Referral Overview & Risk Model Educational Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Referral Program Overview Card */}
        <div className="bg-[#111724] border border-slate-800 hover:border-amber-500/40 rounded-xl p-4 sm:p-5 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-950 border border-amber-700/60 flex items-center justify-center text-amber-400">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white">REFERRAL PROGRAM</h3>
                <span className="text-[10px] font-bold text-amber-400">
                  $30.00 USDT Real Reward Per Qualified Referral
                </span>
              </div>
            </div>
            <button
              onClick={onNavigateToReferrals}
              className="text-xs text-amber-400 hover:underline font-bold"
            >
              View Program
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
              <span className="text-[9px] uppercase font-bold text-slate-500">Total Referrals</span>
              <div className="text-lg font-black text-white">{referrals?.totalReferrals ?? 0}</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
              <span className="text-[9px] uppercase font-bold text-slate-500">Earned Real USDT</span>
              <div className="text-lg font-black text-emerald-400">
                ${(referrals?.totalEarnedUsd ?? 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2">
            <div className="flex-1 font-mono text-center font-black tracking-widest text-cyan-400 text-sm">
              {referrals?.code || "------"}
            </div>
            <button
              onClick={copyReferralCode}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? "Copied" : "Copy Code"}</span>
            </button>
          </div>
        </div>

        {/* Quantitative Risk Governance Card */}
        <div className="bg-[#111724] border border-slate-800 hover:border-cyan-500/40 rounded-xl p-4 sm:p-5 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">PORTFOLIO RISK GOVERNANCE</h3>
              <span className="text-[10px] font-bold text-cyan-400">Automated Protection Rules</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            CryptoHub enforces mathematical risk management to protect trader capital against liquidation.
            All live trades require:
          </p>

          <ul className="space-y-1.5 text-xs text-slate-400">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Mandatory Stop Loss on all live positions</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Minimum 1:1.5 Reward-to-Risk ratio</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Position risk strictly capped at 2.0% of balance</span>
            </li>
          </ul>

          <div className="mt-3 text-[10px] text-slate-500 italic">
            Note: Systematic risk models guide capital preservation. Market outcomes carry inherent variance.
          </div>
        </div>
      </div>
    </div>
  );
};
