"use client";

import React, { useEffect, useState } from "react";
import { ReferralStats } from "@/types";
import { formatMoney } from "@/lib/fx/rates";
import { authFetch } from "@/lib/auth/session";
import {
  Gift,
  Copy,
  Check,
  Users,
  Wallet,
  Mail,
  Plus,
  ShieldCheck,
  Share2,
  Sparkles,
} from "lucide-react";

interface ReferralPanelProps {
  stats: ReferralStats | null;
  currency: "USD" | "KES";
  onSubmitted: () => void;
}

export const ReferralPanel: React.FC<ReferralPanelProps> = ({
  stats,
  currency,
  onSubmitted,
}) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shared, setShared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const effectiveShareUrl = React.useMemo(() => {
    if (!stats) return "";
    let url = stats.shareUrl || `https://cryptoworldinvestment.vercel.app/join?ref=${stats.code}`;
    if (url.includes("localhost")) {
      if (typeof window !== "undefined" && window.location.host && !window.location.host.includes("localhost")) {
        url = `${window.location.origin}/join?ref=${stats.code}`;
      } else {
        url = `https://cryptoworldinvestment.vercel.app/join?ref=${stats.code}`;
      }
    }
    return url.replace(/\/\?ref=/g, "/join?ref=");
  }, [stats]);

  useEffect(() => {
    if (!copiedCode && !copiedLink && !shared) return;
    const t = setTimeout(() => {
      setCopiedCode(false);
      setCopiedLink(false);
      setShared(false);
    }, 2000);
    return () => clearTimeout(t);
  }, [copiedCode, copiedLink, shared]);

  const copyCode = async () => {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(stats.code);
      setCopiedCode(true);
    } catch {
      setMessage({ kind: "err", text: "Clipboard unavailable. Copy the code manually." });
    }
  };

  const copyLink = async () => {
    if (!effectiveShareUrl) return;
    try {
      await navigator.clipboard.writeText(effectiveShareUrl);
      setCopiedLink(true);
    } catch {
      setMessage({ kind: "err", text: "Clipboard unavailable. Copy the link manually." });
    }
  };

  const handleShare = async () => {
    if (!stats) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join CryptoWorldInvestment Live Trading",
          text: `Trade Crypto and Forex with algorithmic risk management on CryptoWorldInvestment (CWI)! Use my referral code ${stats.code} to get started.`,
          url: effectiveShareUrl,
        });
        setShared(true);
      } catch {
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await authFetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: stats?.code, email, name }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({
          kind: "ok",
          text: `Reward credited: ${formatMoney(data.reward.amountUsd, currency)} ($30.00 USDT) directly to your REAL account ledger.`,
        });
        setEmail("");
        setName("");
        onSubmitted();
      } else {
        setMessage({ kind: "err", text: data.error || "Could not register that referral." });
      }
    } catch {
      setMessage({ kind: "err", text: "Network error. Check your connection and retry." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!stats) {
    return (
      <div className="bg-gradient-to-b from-[#101726] to-[#0c111c] border border-cyan-500/20 rounded-xl p-6 text-center text-xs text-slate-400">
        Loading referral data…
      </div>
    );
  }

  return (
    <div className="space-y-3.5 pb-8">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-[#101726] via-[#0e1422] to-[#0c111c] border border-slate-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#e2ff3b]/15 border border-[#e2ff3b]/30 flex items-center justify-center text-[#e2ff3b] shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white tracking-wide">
                  INSTITUTIONAL REFERRAL & TIER PROMOTION PROGRAM
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#071d3a] text-[#38bdf8] border border-[#144588]">
                  REAL CAPITAL
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#e2ff3b]/15 text-[#e2ff3b] border border-[#e2ff3b]/40 shadow-xs">
                  ★ VIP REWARD
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Earn <span className="text-[#e2ff3b] font-bold">$30.00 USDT Direct Bonus</span> per qualified referral credited to your REAL ledger + unlock Level 2 (&gt;10 invites) &amp; Level 1 (&gt;20 invites).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="px-3 py-1.5 rounded-lg bg-[#060c18] border border-[#142848] text-[11px] font-mono text-[#38bdf8] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#e2ff3b]" />
              <span>Direct Ledger Payouts</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Referral Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Referral Code & Share Link Card (Left 6 cols) */}
        <div className="lg:col-span-6 bg-[#101625] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
              Your Unique Referral Code
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex-1 font-mono text-xl sm:text-2xl font-black tracking-[0.25em] text-cyan-400 bg-slate-950/90 border border-cyan-900/60 rounded-xl px-4 py-2.5 text-center">
                {stats.code}
              </div>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Share Link Actions */}
          <div className="pt-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
              Personal Invitation Link
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={effectiveShareUrl}
                className="flex-1 bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 outline-none truncate"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={copyLink}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Link Copied" : "Copy"}</span>
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3.5 py-2 rounded-lg text-xs transition-all active:scale-95"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Referral Metrics (Right 6 cols) */}
        <div className="lg:col-span-6 bg-[#101625] border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">
            Real Portfolio Referral Performance
          </div>
          <div className="grid grid-cols-2 gap-2.5 flex-1">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" /> Total Referred
              </div>
              <div className="text-xl font-black text-white mt-1.5">{stats.totalReferrals}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Invited accounts</div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Qualified
              </div>
              <div className="text-xl font-black text-emerald-400 mt-1.5">{stats.qualified}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Eligible for rewards</div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-400" /> Earned USDT
              </div>
              <div className="text-xl font-black text-emerald-400 mt-1.5">
                ${stats.totalEarnedUsd.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Direct ledger credits</div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
              <div className="text-[10px] uppercase font-bold text-slate-400">Earned KES</div>
              <div className="text-xl font-black text-cyan-400 mt-1.5">
                KSh {stats.totalEarnedKes.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Converted value</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Step-by-Step Tier Progression Rules */}
      <div className="bg-[#101625] border border-slate-800 rounded-xl p-4 sm:p-5">
        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2.5 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" /> Institutional Tier Progression Framework
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5">
            <div className="font-black text-emerald-400 text-xs sm:text-sm mb-1 flex items-center justify-between">
              <span>1. $30.00 USDT Direct</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold">1x Ledger</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Every qualified referral credits strictly $30.00 USDT once to your REAL account via the double-entry ledger.
            </p>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5">
            <div className="font-black text-cyan-400 text-xs sm:text-sm mb-1 flex items-center justify-between">
              <span>2. Level 2 Upgrade</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold">&gt;10 Invites</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Level 3 accounts (≥$300 deposit) with &gt;10 qualified referrals promote automatically to Level 2 ($8–$14 daily return).
            </p>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5">
            <div className="font-black text-amber-400 text-xs sm:text-sm mb-1 flex items-center justify-between">
              <span>3. Level 1 Upgrade</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-400 font-bold">&gt;20 Invites</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Level 3 accounts with &gt;20 qualified referrals promote automatically to Level 1 ($10–$18 daily return).
            </p>
          </div>
        </div>
      </div>

      {/* 4. Action & Log Grid: Form (Left 6 cols) + History (Right 6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Attribute / Credit Form */}
        <form onSubmit={submit} className="lg:col-span-6 bg-[#101625] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
              Register a Referred Trader
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Referred trader email address"
                className="bg-slate-950/90 border border-slate-700/80 focus:border-cyan-500 outline-none rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-600 transition-colors"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Trader name (optional)"
                className="bg-slate-950/90 border border-slate-700/80 focus:border-cyan-500 outline-none rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-600 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2.5 rounded-lg text-xs tracking-wide transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? "Crediting..." : "Register Referral ($30.00 USDT Direct Bonus)"}</span>
            </button>

            {message && (
              <div
                className={`text-xs rounded-lg border p-2.5 ${
                  message.kind === "ok"
                    ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                    : "bg-rose-950/40 border-rose-800 text-rose-300"
                }`}
              >
                {message.text}
              </div>
            )}

            <p className="text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5 border-t border-slate-800/80 pt-2.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-cyan-400 mt-0.5" />
              <span>
                Referral rewards settle into your REAL account ledger. Each referred email is paid once; self-referral is cryptographically prohibited.
              </span>
            </p>
          </div>
        </form>

        {/* Referral History Log (Right 6 cols) */}
        <div className="lg:col-span-6 bg-[#101625] border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Referral History Log
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {stats.records.length} {stats.records.length === 1 ? "record" : "records"}
              </span>
            </div>

            {stats.records.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
                No referral activity logged yet. Share your link above to begin receiving $30 USDT bonuses.
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {stats.records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 bg-slate-950/70 border border-slate-800/80 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-200 font-medium truncate">{r.referredEmail}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Direct ($30 USDT)
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(r.createdAt).toLocaleString("en-KE")} · {r.status}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-400 shrink-0">
                      +${r.rewardUsd.toFixed(2)} USDT
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
            <span>Settled through TRC20 Ledger</span>
            <span className="text-emerald-400 font-bold">100% Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};
