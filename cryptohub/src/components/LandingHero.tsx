"use client";

import React from "react";
import { MarketAsset, AccountType } from "@/types";
import { CwiLogo } from "@/components/CwiLogo";
import {
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Award,
} from "lucide-react";

interface LandingHeroProps {
  assets: MarketAsset[];
  onOpenTerminal: (accountType: AccountType) => void;
  onOpenAuth: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  assets,
  onOpenTerminal,
  onOpenAuth,
}) => {
  const handleCtaClick = () => {
    if (onOpenAuth) {
      onOpenAuth();
    } else {
      onOpenTerminal("REAL");
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* 1. Landing Navigation */}
      <nav className="border-b border-slate-800/80 bg-[#0d121c]/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CwiLogo size={38} variant="icon" />
            <div>
              <span className="font-extrabold text-lg tracking-tight">
                CryptoWorld<span className="text-[#e2ff3b]">Investment</span>
              </span>
              <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#071d3a] text-[#38bdf8] border border-[#144588]">
                CWI • Institutional Quant
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs text-slate-400 font-semibold">
            <a href="#live-vault" className="hover:text-white transition-colors">
              Live TRC20 Vault & Tiers
            </a>
            <a href="#strategy" className="hover:text-white transition-colors">
              Risk Governance
            </a>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCtaClick}
              className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold px-4 py-1.5 rounded-lg text-xs transition-all active:scale-95"
            >
              Enter Live Terminal
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Live Market Ticker Tape — Animated Marquee */}
      <div className="border-b border-slate-800/80 bg-[#0a0f1a] py-2 overflow-hidden">
        <div className="flex items-center">
          <div className="shrink-0 flex items-center gap-2 px-3 border-r border-slate-800 mr-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-slate-500 whitespace-nowrap">Live</span>
          </div>
          <div className="flex items-center gap-6 text-xs whitespace-nowrap animate-ticker" style={{ willChange: "transform" }}>
            {[...assets, ...assets].map((asset, idx) => (
              <div key={`${asset.symbol}-${idx}`} className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-300">{asset.symbol}</span>
                <span className="font-mono font-semibold text-white">
                  ${asset.currentPrice.toLocaleString("en-US", {
                    minimumFractionDigits: asset.digits,
                    maximumFractionDigits: asset.digits,
                  })}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    asset.change24h >= 0
                      ? "text-emerald-400 bg-emerald-950/60"
                      : "text-rose-400 bg-rose-950/60"
                  }`}
                >
                  {asset.change24h >= 0 ? "▲" : "▼"} {Math.abs(asset.change24h).toFixed(2)}%
                </span>
                <span className="text-slate-800 mx-2">·</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Hero Section */}
      <section className="relative px-4 sm:px-6 pt-14 pb-16 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs font-semibold mb-6 shadow-lg shadow-cyan-950/50">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Live Institutional Execution · Double-Entry TRC20 USDT Ledger
        </div>

        <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto">
          Algorithmic Precision for{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
            Live Crypto & Forex
          </span>{" "}
          Markets
        </h1>

        <p className="mt-5 text-sm sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Trade live capital settled on TRON TRC20 USDT under a disciplined{" "}
          <strong className="text-slate-200">quantitative risk management framework</strong> with mandatory Stop Loss protection, daily Auto-Trade tier rewards, and $30.00 USDT referral payouts.
        </p>

        {/* Hero CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <button
            onClick={handleCtaClick}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold px-6 py-3.5 rounded-xl text-sm active:scale-95 transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            Start Live Trading
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 4. Live Institutional Architecture Showcase */}
      <section id="live-vault" className="px-4 sm:px-6 py-16 bg-[#0a0f1b] border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">
              Strictly Real Capital · Zero Synthetic Paper Accounts
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Institutional TRC20 Vault & Server-Derived Reward Tiers
            </h2>
            <p className="text-xs text-slate-400 mt-2 max-w-xl mx-auto">
              Every balance is reconciled against our immutable double-entry ledger with 19-block TRON confirmation finality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* REAL Live Execution Card */}
            <div className="bg-gradient-to-b from-emerald-950/30 to-[#0d1322] border border-emerald-500/40 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-black uppercase tracking-wider">
                  REAL — Live USDT Vault
                </span>
                <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Automated Risk Guard
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2">Institutional Live Trading</h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Fund your live account via Paylor TRC20 USDT (`PAYL-EFSJUF`) and execute directly on verified Binance & Forex market feeds with strict downside containment.
              </p>

              <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  Mandatory Stop Loss & Take Profit on every position
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  Max 2.0% balance risk per trade & min 1:1.5 R:R ratio
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  Controlled TRC20 withdrawals ($100.00 USDT minimum)
                </li>
              </ul>

              <button
                onClick={handleCtaClick}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20"
              >
                Open Live Terminal
              </button>
            </div>

            {/* Auto-Trade Levels & Referral Card */}
            <div className="bg-gradient-to-b from-indigo-950/40 to-[#0d1322] border border-cyan-500/40 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-[11px] font-black uppercase tracking-wider">
                  LEVELS 1–3 — Auto-Trade & Referrals
                </span>
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                  <Award className="w-4 h-4" /> +$30 / Invite
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2">Daily Auto-Trade & $30 Referral Rewards</h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Your account tier is derived automatically on the server from your cumulative confirmed TRC20 deposits and qualified referrals.
              </p>

              <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  Level 3 (≥$300): $5–$8/day · Level 2 (≥$500): $8–$14/day
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  Level 1 (≥$600 or &gt;20 invites): $10–$18/day + $1 Wed Bonus
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  $30.00 USDT credited to REAL ledger per qualified referral
                </li>
              </ul>

              <button
                onClick={handleCtaClick}
                className="w-full py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs transition-all"
              >
                Access Rewards & Referrals
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. The Mathematical Edge (Risk Model) */}
      <section id="strategy" className="px-4 sm:px-6 py-16 max-w-6xl mx-auto">
        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Quantitative Economics
              </span>
              <h2 className="text-2xl font-black text-white mt-1">
                Quantitative Risk Management Framework
              </h2>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                Disciplined traders preserve capital through mathematical asymmetry. Our engine enforces downside containment by restricting risk per trade with mandatory Stop Loss and requiring favorable risk-to-reward ratios on every execution:
              </p>

              <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
                <div className="text-cyan-400 font-bold mb-1">Risk Asymmetry Model:</div>
                <div className="text-emerald-400 font-semibold">+ 1:2.0 Minimum Reward-to-Risk Setup</div>
                <div className="text-rose-400 font-semibold">- 2.0% Maximum Balance Risk Cap</div>
                <div className="text-white font-bold border-t border-slate-700 pt-1 mt-1">
                  100% Mandatory Stop-Loss Enforcement
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl">
                <div className="text-3xl font-black text-emerald-400">1:1.5+</div>
                <div className="text-xs font-bold text-white mt-1">Reward to Risk</div>
                <div className="text-[10px] text-slate-500 mt-1">Enforced minimum ratio</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl">
                <div className="text-3xl font-black text-cyan-400">2.0%</div>
                <div className="text-xs font-bold text-white mt-1">Max Risk / Trade</div>
                <div className="text-[10px] text-slate-500 mt-1">Balance protection cap</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl">
                <div className="text-3xl font-black text-amber-400">100%</div>
                <div className="text-xs font-bold text-white mt-1">Mandatory SL</div>
                <div className="text-[10px] text-slate-500 mt-1">Zero naked positions</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl">
                <div className="text-3xl font-black text-indigo-400">TRC20</div>
                <div className="text-xs font-bold text-white mt-1">Ledger Audited</div>
                <div className="text-[10px] text-slate-500 mt-1">Immutable settlement</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0a0e18] py-8 px-6 text-center text-xs text-slate-500">
        <p>© 2026 CryptoWorldInvestment (CWI) Quantitative Institutional Terminal. All rights reserved.</p>
        <p className="mt-1 text-[11px] text-slate-600">
          Trading cryptocurrencies and foreign exchange involves substantial risk of loss. All accounts operate on live capital.
        </p>
      </footer>
    </div>
  );
};
