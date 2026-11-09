"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import confetti from "canvas-confetti";
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
  Search,
  Eye,
  EyeOff,
  Wallet,
  CreditCard,
  Gift,
  LayoutGrid,
  ArrowDown,
  X,
  Sparkles,
  Layers,
  Check,
  Copy,
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
  usdKesRate?: number;
  onNavigateToTrade: (accountType?: AccountType, asset?: MarketAsset) => void;
  onNavigateToReferrals: () => void;
  onNavigateToMike: () => void;
  onOpenDeposit: (tab?: "DEPOSIT" | "WITHDRAW") => void;
  onCloseTrade: (tradeId: string, exitPrice: number) => void;
  onRefreshBalance?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
  balance,
  profile,
  referrals,
  trades,
  assets,
  currency,
  usdKesRate = 129.5,
  onNavigateToTrade,
  onNavigateToReferrals,
  onNavigateToMike,
  onOpenDeposit,
  onCloseTrade,
  onRefreshBalance,
}) => {
  const [showBalance, setShowBalance] = useState(true);
  const [dismissBanner, setDismissBanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryTab, setCategoryTab] = useState<"hot" | "favorites" | "options">("hot");
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [favorites] = useState<string[]>(["BTC/USDT", "ETH/USDT", "SOL/USDT"]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isAutoTrading, setIsAutoTrading] = useState(false);

  const [levelInfo, setLevelInfo] = useState<{
    effectiveLevel: number;
    cumulativeDeposits: number;
    successfulReferralsCount: number;
    dailyEarningRange: [number, number] | null;
    eligibleForAutoTrade: boolean;
    withdrawableEarnings: number;
    hasRunToday: boolean;
  } | null>(null);

  const fetchLevels = useCallback(() => {
    authFetch("/api/rewards/levels")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) {
          setLevelInfo({
            effectiveLevel: d.effectiveLevel ?? 0,
            cumulativeDeposits: d.cumulativeDeposits ?? 0,
            successfulReferralsCount: d.successfulReferralsCount ?? 0,
            dailyEarningRange: d.dailyEarningRange ?? null,
            eligibleForAutoTrade: Boolean(d.eligibleForAutoTrade),
            withdrawableEarnings: d.withdrawableEarnings ?? 0,
            hasRunToday: Boolean(d.hasRunToday),
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels, balance?.availableBalance]);

  const handleRunAutoTrade = async () => {
    if (!levelInfo || levelInfo.effectiveLevel === 0) {
      alert("Quantitative Auto-Trade requires a working capital deposit of at least $300.00 USDT (Level 3: $5–$8/day, Level 2: $8–$14/day, Level 1: $10–$18/day).\n\nOpening deposit interface...");
      onOpenDeposit("DEPOSIT");
      return;
    }

    if (levelInfo.hasRunToday) {
      alert("Today's Quantitative Auto-Trade yield has already been credited to your withdrawable earnings.\n\nNext daily cycle unlocks at 00:00 UTC.");
      return;
    }

    setIsAutoTrading(true);
    try {
      const res = await authFetch("/api/rewards/auto-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success && data.result) {
        if (data.result.credited) {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
          alert(`⚡ Daily Auto-Trade Yield Credited!\n+$${data.result.amount.toFixed(2)} USDT has been added to your withdrawable balance.`);
          fetchLevels();
          onRefreshBalance?.();
        } else {
          alert(`Auto-Trade Status:\n${data.result.reason}`);
        }
      }
    } catch {
      alert("Network error communicating with Auto-Trade engine.");
    } finally {
      setIsAutoTrading(false);
    }
  };

  // Base Daily Micro-Bot State (5 x $0.20 = $1.00/day for all registered accounts)
  const [microStatus, setMicroStatus] = useState<{
    today: string;
    completedCount: number;
    completedAmount: number;
    maxDailyAmount: number;
    maxDailyCount: number;
    canExecuteNext: boolean;
    positions: any[];
  } | null>(null);
  const [isExecutingMicro, setIsExecutingMicro] = useState(false);

  const fetchMicroStatus = useCallback(() => {
    authFetch("/api/rewards/auto-trade")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success && d.microTradeStatus) {
          setMicroStatus(d.microTradeStatus);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMicroStatus();
  }, [fetchMicroStatus, balance?.availableBalance]);

  const handleExecuteMicroTrade = async () => {
    if (isExecutingMicro) return;
    setIsExecutingMicro(true);
    try {
      const res = await authFetch("/api/rewards/auto-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "MICRO" }),
      });
      const data = await res.json();
      if (data?.success && data.result) {
        if (data.result.credited) {
          confetti({ particleCount: 50, spread: 55, origin: { y: 0.7 } });
          fetchMicroStatus();
          fetchLevels();
          onRefreshBalance?.();
        } else {
          alert(data.result.reason || "Daily base bot limit of $1.00 reached.");
        }
      }
    } catch {
      // Ignored
    } finally {
      setIsExecutingMicro(false);
    }
  };

  // Sequentially tick through available micro-trades while user stays on Self Service tab to bring lively updates
  useEffect(() => {
    if (categoryTab !== "favorites" || !microStatus?.canExecuteNext || isExecutingMicro) return;
    const timer = setTimeout(() => {
      handleExecuteMicroTrade();
    }, 12000);
    return () => clearTimeout(timer);
  }, [categoryTab, microStatus?.canExecuteNext, isExecutingMicro]);

  const realBal = balance ?? profile?.real;
  const realAvailable =
    balance?.availableBalance !== undefined && balance.availableBalance !== null
      ? balance.availableBalance
      : profile?.real?.availableBalance ?? 0;
  const realEquity =
    balance?.equity !== undefined && balance.equity !== null
      ? balance.equity
      : profile?.real?.equity ?? realAvailable;
  const realDeposited =
    balance?.totalDeposited !== undefined && balance.totalDeposited !== null
      ? balance.totalDeposited
      : profile?.real?.totalDeposited ?? 0;
  const realFreeMargin =
    balance?.freeMargin !== undefined && balance.freeMargin !== null
      ? balance.freeMargin
      : profile?.real?.freeMargin ?? realAvailable;

  const activeTrades = trades.filter((t) => t.status === "OPEN");

  // Filtering assets based on category tab & search
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          asset.symbol.toLowerCase().includes(query) ||
          asset.assetClass.toLowerCase().includes(query)
        );
      }
      if (categoryTab === "favorites") {
        return favorites.includes(asset.symbol);
      }
      if (categoryTab === "options") {
        return asset.assetClass === "FOREX";
      }
      return true;
    });
  }, [assets, categoryTab, searchQuery, favorites]);

  const getCoinBadge = (symbol: string) => {
    const clean = symbol.replace("/USDT", "").replace("USDT", "").toUpperCase();
    if (clean.includes("BTC")) {
      return { bg: "bg-[#f7931a]", text: "text-white font-black", icon: "₿" };
    }
    if (clean.includes("ETH")) {
      return { bg: "bg-[#627eea]", text: "text-white font-bold", icon: "♦" };
    }
    if (clean.includes("SOL")) {
      return { bg: "bg-gradient-to-tr from-[#14f195] to-[#9945ff]", text: "text-white font-black", icon: "S" };
    }
    if (clean.includes("BNB")) {
      return { bg: "bg-[#f3ba2f]", text: "text-slate-950 font-black", icon: "◆" };
    }
    if (clean.includes("XRP")) {
      return { bg: "bg-[#0b1b33] border border-[#1e3e6b]", text: "text-white font-black", icon: "✕" };
    }
    if (clean.includes("DOGE")) {
      return { bg: "bg-[#c2a633]", text: "text-slate-950 font-black", icon: "Ð" };
    }
    if (clean.includes("EUR") || clean.includes("GBP") || clean.includes("JPY")) {
      return { bg: "bg-[#0284c7]", text: "text-white font-black", icon: "€" };
    }
    return { bg: "bg-[#0ea5e9]", text: "text-white font-bold", icon: clean.slice(0, 2) };
  };

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
    <div className="space-y-3.5 w-full max-w-[1400px] mx-auto pb-16">
      {/* 1. Top Notice / App Download Banner (Midnight Ocean + Acid Yellow) */}
      {!dismissBanner && (
        <div className="flex items-center justify-between bg-[#071326] border border-[#142e54] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 shadow-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-[#0284c7] via-[#0ea5e9] to-[#e2ff3b] flex items-center justify-center text-[#050b14] font-black text-xs shrink-0 shadow-md">
              ⚡
            </div>
            <span className="truncate text-xs sm:text-sm font-medium text-slate-300">
              To access additional features, click to download the app.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={() => alert("CryptoWorldInvestment (CWI) Android PWA / APK package is configured. Add to Home Screen via browser menu for full native installation.")}
              className="h-7 w-7 rounded-full bg-[#e2ff3b] hover:bg-[#d5f32a] text-[#050b14] flex items-center justify-center font-black transition-all active:scale-95 shadow-md shadow-[#e2ff3b]/20"
              title="Download Android App"
            >
              <ArrowDown className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              onClick={() => setDismissBanner(true)}
              className="text-[#7c93b2] hover:text-white p-1 transition-colors"
              title="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Sleek Midnight Ocean Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#7c93b2] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search crypto pairs (BTC, ETH, SOL...)"
          className="w-full bg-[#060e1c] border border-[#142848] rounded-full pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-[#5c7395] focus:outline-none focus:border-[#e2ff3b]/60 focus:ring-1 focus:ring-[#e2ff3b]/30 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7c93b2] hover:text-white text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {/* 3. Total Balance Card (Midnight Blue, Ocean Border, Acid Yellow Hero Balance & Button) */}
      <div className="bg-gradient-to-b from-[#0a182e] via-[#071224] to-[#050d1a] border border-[#16345e] rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        {/* Ambient Oceanic Glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#0ea5e9]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-[#8ea2be] text-xs sm:text-sm font-medium">
              <span>Total Balance</span>
              <button
                onClick={() => setShowBalance((s) => !s)}
                className="text-[#7c93b2] hover:text-[#e2ff3b] transition-colors p-0.5 focus:outline-none"
                title={showBalance ? "Hide balance" : "Show balance"}
              >
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-[#e2ff3b] font-mono tracking-tight drop-shadow-[0_0_20px_rgba(226,255,59,0.3)]">
                {showBalance
                  ? (currency === "KES"
                      ? (realAvailable * (usdKesRate || 129.5)).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                      : realAvailable.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                  : "••••••"}
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#38bdf8]">
                {currency === "USD" ? "USDT" : "KES"}
              </span>
            </div>

            {/* Dual Currency Reflection: KES Equivalent */}
            <div className="flex items-center gap-1.5 text-xs text-[#7c93b2] font-mono mt-0.5">
              <span className="text-slate-400">≈</span>
              <span className="text-[#e2ff3b] font-bold">
                {showBalance
                  ? currency === "KES"
                    ? `$${realAvailable.toFixed(2)} USDT`
                    : `KES ${(realAvailable * (usdKesRate || 129.5)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "••••••"}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {currency === "KES" ? "USDT" : "KES"}
              </span>
              {realAvailable >= 5.0 && (
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded ml-1">
                  Verified Real Balance
                </span>
              )}
            </div>
          </div>

          {/* Hero Acid Yellow Pill Deposit Button */}
          <button
            onClick={() => onOpenDeposit("DEPOSIT")}
            className="bg-[#e2ff3b] hover:bg-[#d5f32a] text-[#050b14] font-black px-6 py-2.5 rounded-full text-xs sm:text-sm shadow-lg shadow-[#e2ff3b]/25 transition-all active:scale-95 hover:brightness-105 shrink-0"
          >
            Deposit
          </button>
        </div>

        {/* Secondary Account Metrics Strip: Equity | Free Margin | Working Capital | Withdrawable */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-[#142848] text-[11px] relative z-10">
          <div>
            <span className="text-[#5c7395] uppercase block font-semibold text-[9px]">Equity</span>
            <span className="font-mono font-bold text-[#38bdf8]">
              {showBalance ? formatMoney(realEquity, currency) : "••••••"}
            </span>
          </div>
          <div>
            <span className="text-[#5c7395] uppercase block font-semibold text-[9px]">Free Margin</span>
            <span className="font-mono font-bold text-[#7dd3fc]">
              {showBalance ? formatMoney(realFreeMargin, currency) : "••••••"}
            </span>
          </div>
          <div>
            <span className="text-[#5c7395] uppercase block font-semibold text-[9px]">Working Capital</span>
            <span className="font-mono font-bold text-slate-200">
              {showBalance ? formatMoney(realDeposited, currency) : "••••••"}
            </span>
          </div>
          <div>
            <span className="text-[#5c7395] uppercase block font-semibold text-[9px] flex items-center gap-1">
              <span>Withdrawable</span>
              {(levelInfo?.withdrawableEarnings ?? 0) >= 100 && (
                <span className="text-[8px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-1 py-0.2 rounded font-bold">≥$100</span>
              )}
            </span>
            <span className="font-mono font-bold text-[#e2ff3b]">
              {showBalance ? formatMoney(levelInfo?.withdrawableEarnings ?? 0, currency) : "••••••"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Four Circular Quick Action Buttons (Deposit | Withdrawal | Invite | More) */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 py-2">
        {/* Deposit */}
        <button
          onClick={() => onOpenDeposit("DEPOSIT")}
          className="flex flex-col items-center justify-center gap-1.5 group active:scale-95 transition-transform"
        >
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#0a182e] group-hover:bg-[#0f2444] border border-[#163660] group-hover:border-[#e2ff3b]/50 flex items-center justify-center shadow-xl transition-all">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-[#38bdf8] group-hover:text-[#e2ff3b] transition-colors" />
          </div>
          <span className="text-xs font-semibold text-[#8ea2be] group-hover:text-white transition-colors">
            Deposit
          </span>
        </button>

        {/* Withdrawal */}
        <button
          onClick={() => onOpenDeposit("WITHDRAW")}
          className="flex flex-col items-center justify-center gap-1.5 group active:scale-95 transition-transform"
        >
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#0a182e] group-hover:bg-[#0f2444] border border-[#163660] group-hover:border-[#e2ff3b]/50 flex items-center justify-center shadow-xl transition-all">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-[#38bdf8] group-hover:text-[#e2ff3b] transition-colors" />
          </div>
          <span className="text-xs font-semibold text-[#8ea2be] group-hover:text-white transition-colors">
            Withdrawal
          </span>
        </button>

        {/* Invite */}
        <button
          onClick={onNavigateToReferrals}
          className="flex flex-col items-center justify-center gap-1.5 group active:scale-95 transition-transform"
        >
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#0a182e] group-hover:bg-[#0f2444] border border-[#163660] group-hover:border-[#e2ff3b]/50 flex items-center justify-center shadow-xl transition-all">
            <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-[#38bdf8] group-hover:text-[#e2ff3b] transition-colors" />
          </div>
          <span className="text-xs font-semibold text-[#8ea2be] group-hover:text-white transition-colors">
            Invite
          </span>
        </button>

        {/* More */}
        <button
          onClick={() => setIsMoreOpen((v) => !v)}
          className="flex flex-col items-center justify-center gap-1.5 group active:scale-95 transition-transform"
        >
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#0a182e] group-hover:bg-[#0f2444] border border-[#163660] group-hover:border-[#e2ff3b]/50 flex items-center justify-center shadow-xl transition-all">
            <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-[#38bdf8] group-hover:text-[#e2ff3b] transition-colors" />
          </div>
          <span className="text-xs font-semibold text-[#8ea2be] group-hover:text-white transition-colors">
            More
          </span>
        </button>
      </div>

      {/* 5. One-Click Copy Trading Promotional Banner (Futuristic Ocean Hologram + Acid Accents) */}
      <div
        onClick={handleRunAutoTrade}
        role="button"
        tabIndex={0}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#030c1c] via-[#081a38] to-[#040e24] border border-[#143564] hover:border-[#0ea5e9]/60 p-4 sm:p-5 cursor-pointer shadow-2xl transition-all group"
      >
        <div className="flex items-center justify-between gap-4">
          {/* Holographic Glowing Bitcoin Core */}
          <div className="relative flex items-center justify-center shrink-0 w-20 h-20 sm:w-24 sm:h-24">
            <div className="absolute inset-0 rounded-full bg-[#0ea5e9]/20 blur-xl group-hover:bg-[#0ea5e9]/30 transition-all" />
            <div className="absolute inset-1 rounded-full border border-[#0ea5e9]/50 border-dashed animate-spin" style={{ animationDuration: "12s" }} />
            <div className="absolute inset-3 rounded-full border border-[#38bdf8] shadow-[0_0_15px_rgba(56,189,248,0.6)]" />
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-tr from-[#0284c7] via-[#0ea5e9] to-[#e2ff3b] flex items-center justify-center text-[#050b14] font-black text-lg sm:text-xl shadow-lg shadow-[#0ea5e9]/50">
              {isAutoTrading ? "⚡" : "₿"}
            </div>
          </div>

          {/* Copy Trading Information */}
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#38bdf8] mb-0.5">
              <Sparkles className="w-3 h-3 text-[#e2ff3b]" />
              <span>
                QUANTITATIVE AUTO-TRADE{" "}
                {levelInfo && levelInfo.effectiveLevel > 0
                  ? `• LEVEL ${levelInfo.effectiveLevel} ACTIVE`
                  : "• UNLOCK TIER"}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-tight group-hover:text-[#7dd3fc] transition-colors">
              {levelInfo && levelInfo.effectiveLevel > 0
                ? levelInfo.hasRunToday
                  ? "Today's Yield Credited ✓"
                  : `Claim Daily Yield ($${levelInfo.dailyEarningRange?.[0]?.toFixed(2)}–$${levelInfo.dailyEarningRange?.[1]?.toFixed(2)} USDT)`
                : "One-click copy trading"}
            </h3>
            <p className="text-xs sm:text-sm text-[#e2ff3b] font-bold mt-0.5 flex items-center gap-1">
              <span className="text-[#38bdf8]">&gt;&gt;&gt;</span>
              <span>
                {levelInfo && levelInfo.effectiveLevel > 0
                  ? levelInfo.hasRunToday
                    ? "Active in quantitative model • Next cycle unlocks 00:00 UTC"
                    : isAutoTrading
                    ? "Executing algorithmic trades..."
                    : "Tap to credit today's automated trading profit"
                  : "Deposit $300 to activate daily yields."}
              </span>
            </p>
          </div>

          {/* Indicator Badge */}
          <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-[#e2ff3b] text-[#050b14] shadow-sm">
              {levelInfo && levelInfo.effectiveLevel > 0
                ? `L${levelInfo.effectiveLevel}`
                : "1/2"}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Market Category Tabs & Section Header */}
      <div className="pt-2">
        <div className="flex items-center gap-6 border-b border-[#142848] pb-2">
          <button
            onClick={() => setCategoryTab("hot")}
            className={`text-sm sm:text-base font-bold transition-colors relative ${
              categoryTab === "hot"
                ? "text-[#e2ff3b]"
                : "text-[#7c93b2] hover:text-white"
            }`}
          >
            Hot
            {categoryTab === "hot" && (
              <span className="absolute -bottom-2 inset-x-0 h-0.5 bg-[#e2ff3b] shadow-[0_0_10px_rgba(226,255,59,0.7)] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setCategoryTab("favorites")}
            className={`text-sm sm:text-base font-bold transition-colors relative ${
              categoryTab === "favorites"
                ? "text-[#e2ff3b]"
                : "text-[#7c93b2] hover:text-white"
            }`}
          >
            Self Service
            {categoryTab === "favorites" && (
              <span className="absolute -bottom-2 inset-x-0 h-0.5 bg-[#e2ff3b] shadow-[0_0_10px_rgba(226,255,59,0.7)] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setCategoryTab("options")}
            className={`text-sm sm:text-base font-bold transition-colors relative ${
              categoryTab === "options"
                ? "text-[#e2ff3b]"
                : "text-[#7c93b2] hover:text-white"
            }`}
          >
            Options
            {categoryTab === "options" && (
              <span className="absolute -bottom-2 inset-x-0 h-0.5 bg-[#e2ff3b] shadow-[0_0_10px_rgba(226,255,59,0.7)] rounded-full" />
            )}
          </button>
        </div>

        <div className="mt-2 text-xs font-bold text-[#e2ff3b]">
          {categoryTab === "options" ? "Options & Forex Derivatives" : categoryTab === "favorites" ? "AI Quantitative Bot Live Positions" : "Hot Crypto Markets"}
        </div>
      </div>

      {/* 7. Self Service Category Tab: Institutional Bot Positions (MetaTrader Style) */}
      {categoryTab === "favorites" ? (
        <div className="space-y-3.5">
          {/* Quantitative Bot Control Card */}
          <div className="bg-[#071324] border border-[#142848] rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h4 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                    CWI Quantitative AI Bot • Live Execution
                  </h4>
                </div>
                <p className="text-xs text-[#7c93b2] mt-0.5">
                  Automated Base Yield: <span className="text-[#e2ff3b] font-bold">$1.00 USDT / day</span> for registered traders (5 micro-trades of $0.20 credited sequentially).
                </p>
              </div>

              {/* Progress & Micro-Trade Trigger Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {microStatus?.canExecuteNext ? (
                  <button
                    onClick={handleExecuteMicroTrade}
                    disabled={isExecutingMicro}
                    className="w-full sm:w-auto bg-[#e2ff3b] hover:bg-[#d5f32a] text-[#050b14] font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#e2ff3b]/20 active:scale-95 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>
                      {isExecutingMicro
                        ? "Executing AI Trade..."
                        : `Execute Next Trade (+0.20 USDT) [${microStatus?.completedCount ?? 0}/5]`}
                    </span>
                  </button>
                ) : (
                  <div className="w-full sm:w-auto text-center px-4 py-2 bg-emerald-950/70 border border-emerald-800/70 text-emerald-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-inner">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Daily Bot Yield Complete ($1.00 USDT Credited)</span>
                  </div>
                )}
              </div>
            </div>

            {/* 5-Step Progress Pills */}
            <div className="mt-3.5 pt-3 border-t border-[#142848]/70">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#7c93b2] mb-1.5">
                <span>Daily Bot Progress:</span>
                <span className="text-[#e2ff3b] font-bold">
                  ${(microStatus?.completedAmount ?? 0).toFixed(2)} / $1.00 USDT ({microStatus?.completedCount ?? 0}/5 Done)
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((step) => {
                  const isDone = (microStatus?.completedCount ?? 0) >= step;
                  const isCurrent = (microStatus?.completedCount ?? 0) + 1 === step;
                  return (
                    <div
                      key={step}
                      className={`h-2 rounded-full transition-all ${
                        isDone
                          ? "bg-gradient-to-r from-[#0ea5e9] to-[#e2ff3b] shadow-xs"
                          : isCurrent
                          ? "bg-[#163660] border border-[#e2ff3b]/60 animate-pulse"
                          : "bg-[#0c1c34]"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Institutional Positions Terminal List (Identical to MetaTrader Screenshot) */}
          <div className="bg-[#071324] border border-[#142848] rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#142848]">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">Positions</h3>
                <span className="text-[10px] font-mono text-[#38bdf8] font-bold bg-[#0b1f3d] border border-[#143564] px-2 py-0.5 rounded-full">
                  LIVE QUANTITATIVE ORDER BOOK
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchMicroStatus}
                  className="text-slate-400 hover:text-white p-1 text-sm font-bold tracking-widest"
                  title="Refresh bot positions"
                >
                  •••
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#142848]/70">
              {(microStatus?.positions && microStatus.positions.length > 0
                ? microStatus.positions
                : [
                    {
                      id: "p1",
                      symbol: "XAUUSD",
                      direction: "SELL",
                      size: 0.05,
                      entryPrice: 4412.9,
                      currentPrice: 3991.62,
                      pnl: 35139.83,
                      isProfit: true,
                      status: "CLOSED",
                      timestamp: "Active",
                    },
                    {
                      id: "p2",
                      symbol: "XAUUSD",
                      direction: "SELL",
                      size: 0.05,
                      entryPrice: 4412.77,
                      currentPrice: 3991.62,
                      pnl: 35128.98,
                      isProfit: true,
                      status: "CLOSED",
                      timestamp: "Active",
                    },
                    {
                      id: "p3",
                      symbol: "XAUUSD",
                      direction: "SELL",
                      size: 0.05,
                      entryPrice: 4412.75,
                      currentPrice: 3991.62,
                      pnl: 35127.32,
                      isProfit: true,
                      status: "OPEN",
                      timestamp: "Active",
                    },
                    {
                      id: "p4",
                      symbol: "XAUUSD",
                      direction: "SELL",
                      size: 0.05,
                      entryPrice: 4412.73,
                      currentPrice: 3991.62,
                      pnl: 35125.65,
                      isProfit: true,
                      status: "OPEN",
                      timestamp: "Active",
                    },
                    {
                      id: "p5",
                      symbol: "XAUUSD",
                      direction: "SELL",
                      size: 0.05,
                      entryPrice: 4412.78,
                      currentPrice: 3991.62,
                      pnl: 35129.82,
                      isProfit: true,
                      status: "OPEN",
                      timestamp: "Active",
                    },
                    {
                      id: "p6",
                      symbol: "XAUUSD",
                      direction: "SELL",
                      size: 0.05,
                      entryPrice: 4412.75,
                      currentPrice: 3991.62,
                      pnl: 35127.32,
                      isProfit: true,
                      status: "OPEN",
                      timestamp: "Active",
                    },
                    {
                      id: "p7",
                      symbol: "EURUSD",
                      direction: "SELL",
                      size: 0.1,
                      entryPrice: 1.082,
                      currentPrice: 1.0841,
                      pnl: -210.0,
                      isProfit: false,
                      status: "OPEN",
                      timestamp: "Hedged",
                    },
                  ]
              ).map((pos: any) => {
                const isProfit = pos.isProfit;
                return (
                  <div
                    key={pos.id}
                    className="py-3 px-1 hover:bg-[#0c1c34]/40 transition-colors flex flex-col gap-1 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      {/* Left: Symbol, Direction, Size */}
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm sm:text-base text-white tracking-tight">
                          {pos.symbol}
                        </span>
                        <span
                          className={`text-xs font-bold uppercase ${
                            pos.direction === "SELL" ? "text-rose-400" : "text-[#38bdf8]"
                          }`}
                        >
                          {pos.direction.toLowerCase()}
                        </span>
                        <span className="font-mono text-xs sm:text-sm text-slate-300 font-semibold">
                          {pos.size.toFixed(2)}
                        </span>
                      </div>

                      {/* Right: Institutional Profit / Loss (Cyan/Green for profit, Red for loss) */}
                      <div className="text-right">
                        <span
                          className={`font-mono font-black text-sm sm:text-base md:text-lg tracking-tight ${
                            isProfit
                              ? "text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]"
                              : "text-rose-400"
                          }`}
                        >
                          {isProfit ? "" : "-"}
                          {Math.abs(pos.pnl)
                            .toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            .replace(/,/g, " ")}
                        </span>
                      </div>
                    </div>

                    {/* Sub-row: Entry -> Exit route and Credited Status Badge */}
                    <div className="flex items-center justify-between text-xs font-mono text-[#7c93b2]">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] sm:text-xs">
                        <span>{pos.entryPrice.toFixed(3)}</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-slate-200 font-semibold">{pos.currentPrice.toFixed(3)}</span>
                      </div>
                      <div>
                        {pos.status === "CLOSED" ? (
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                            +$0.20 Credited ✓
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#e2ff3b] font-semibold flex items-center gap-1 bg-[#0b1f3d] px-2 py-0.5 rounded-full border border-[#143564]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#e2ff3b] animate-ping" />
                            {pos.timestamp}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 8. Standard Market Table Header (Hot & Options tabs) */}
          <div className="grid grid-cols-12 text-[#7c93b2] text-xs font-semibold px-2 py-1.5 select-none">
            <div className="col-span-5 flex items-center gap-1">
              <span>Crypto</span>
              <span className="text-[10px] text-[#5c7395]">↕</span>
            </div>
            <div className="col-span-4 text-right flex items-center justify-end gap-1">
              <span>Last Price</span>
              <span className="text-[10px] text-[#5c7395]">↕</span>
            </div>
            <div className="col-span-3 text-right flex items-center justify-end gap-1">
              <span>24h %</span>
              <span className="text-[10px] text-[#5c7395]">↕</span>
            </div>
          </div>

          {/* Crypto Coin List Rows */}
          <div className="space-y-1">
            {filteredAssets.length === 0 ? (
              <div className="text-center py-10 bg-[#071324] rounded-xl border border-dashed border-[#142848] text-[#7c93b2] text-xs">
                No instruments found matching &quot;{searchQuery}&quot;.
              </div>
            ) : (
              filteredAssets.map((asset) => {
                const isPositive = asset.change24h >= 0;
                const badge = getCoinBadge(asset.symbol);
                const symbolBase = asset.symbol.replace("/USDT", "").replace("USDT", "");
                const quoteCurrency = asset.assetClass === "FOREX" ? "" : "USDT";

                return (
                  <div
                    key={asset.symbol}
                    onClick={() => onNavigateToTrade("REAL", asset)}
                    role="button"
                    tabIndex={0}
                    className="grid grid-cols-12 items-center bg-[#071324]/85 hover:bg-[#0c1c34] border border-[#122544] hover:border-[#1d4274] rounded-xl px-2.5 py-3 transition-all active:scale-[0.99] cursor-pointer group shadow-sm"
                  >
                    {/* Coin Icon & Name */}
                    <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                      <div
                        className={`h-8 w-8 rounded-full ${badge.bg} ${badge.text} flex items-center justify-center text-xs shrink-0 shadow`}
                      >
                        {badge.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-extrabold text-xs sm:text-sm text-white group-hover:text-[#e2ff3b] transition-colors truncate">
                            {symbolBase}
                          </span>
                          {quoteCurrency && (
                            <span className="text-[10px] text-[#7c93b2] font-medium">
                              {quoteCurrency}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#5c7395] font-mono hidden xs:block">
                          {asset.assetClass}
                        </div>
                      </div>
                    </div>

                    {/* Last Price */}
                    <div className="col-span-4 text-right pr-2">
                      <div className="font-mono font-bold text-xs sm:text-sm text-white group-hover:text-[#e2ff3b] transition-colors">
                        {asset.currentPrice.toLocaleString("en-US", {
                          minimumFractionDigits: asset.digits,
                          maximumFractionDigits: asset.digits,
                        })}
                      </div>
                    </div>

                    {/* 24h % Pill Badge */}
                    <div className="col-span-3 text-right">
                      <span
                        className={`inline-block font-mono font-bold text-xs px-2.5 py-1.5 rounded-lg text-white shadow-xs min-w-[70px] text-center ${
                          isPositive ? "bg-[#10b981]" : "bg-[#eb4b5f]"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {asset.change24h.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* 9. Open Positions Section */}
      {activeTrades.length > 0 && (
        <div className="bg-[#071324] border border-[#142848] rounded-2xl p-4 shadow-xl mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#e2ff3b]" />
              <h3 className="font-extrabold text-xs sm:text-sm text-white uppercase tracking-wider">
                Open Positions ({activeTrades.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigateToTrade("REAL")}
              className="text-xs text-[#38bdf8] hover:text-[#e2ff3b] hover:underline font-bold"
            >
              Open Terminal
            </button>
          </div>

          <div className="space-y-2">
            {activeTrades.map((trade) => {
              const isLong = trade.direction === "LONG";
              const isProfit = trade.pnl >= 0;
              return (
                <div
                  key={trade.id}
                  className="bg-[#050c18] border border-[#142848] rounded-xl p-3 flex items-center justify-between gap-2"
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
                      <div className="text-[10px] text-[#5c7395]">
                        {trade.size} @ ${trade.entryPrice}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-black text-xs font-mono ${
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
        </div>
      )}

      {/* 10. "More" Quick Sheet Modal */}
      {isMoreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#040810]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-fade-in"
        >
          <div className="bg-[#081324] border border-[#142848] rounded-2xl w-full max-w-md p-4 sm:p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#142848] pb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-[#38bdf8]" />
                <h3 className="font-extrabold text-sm text-white">Platform Services & Actions</h3>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="text-[#7c93b2] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  onNavigateToMike();
                }}
                className="bg-[#0a182e] hover:bg-[#0f2444] border border-[#163660] hover:border-[#e2ff3b]/40 p-3 rounded-xl text-left transition-colors flex flex-col gap-1"
              >
                <Sparkles className="w-4 h-4 text-[#e2ff3b]" />
                <span className="font-bold text-xs text-white">Mike AI Assistant</span>
                <span className="text-[10px] text-[#7c93b2]">Quantitative insights & trading</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  onNavigateToReferrals();
                }}
                className="bg-[#0a182e] hover:bg-[#0f2444] border border-[#163660] hover:border-[#e2ff3b]/40 p-3 rounded-xl text-left transition-colors flex flex-col gap-1"
              >
                <Gift className="w-4 h-4 text-[#38bdf8]" />
                <span className="font-bold text-xs text-white">Invite & Bonus</span>
                <span className="text-[10px] text-[#7c93b2]">$30.00 USDT per qualified friend</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  onOpenDeposit("DEPOSIT");
                }}
                className="bg-[#0a182e] hover:bg-[#0f2444] border border-[#163660] hover:border-[#e2ff3b]/40 p-3 rounded-xl text-left transition-colors flex flex-col gap-1"
              >
                <Wallet className="w-4 h-4 text-[#e2ff3b]" />
                <span className="font-bold text-xs text-white">Deposit USDT</span>
                <span className="text-[10px] text-[#7c93b2]">Instant TRC20 Ledger</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  onOpenDeposit("WITHDRAW");
                }}
                className="bg-[#0a182e] hover:bg-[#0f2444] border border-[#163660] hover:border-[#e2ff3b]/40 p-3 rounded-xl text-left transition-colors flex flex-col gap-1"
              >
                <CreditCard className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-xs text-white">Withdraw Funds</span>
                <span className="text-[10px] text-[#7c93b2]">Secure automated payout</span>
              </button>
            </div>

            {/* Level Tier Status inside More */}
            <div className="bg-[#050c18] border border-[#142848] rounded-xl p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#7c93b2]">Tier Status:</span>
                <span className="font-bold text-[#e2ff3b]">
                  {levelInfo && levelInfo.effectiveLevel > 0
                    ? `Level ${levelInfo.effectiveLevel} VIP`
                    : "Active Trader"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-[#7c93b2]">Referral Code:</span>
                <div className="flex items-center gap-1.5 font-mono text-[#38bdf8] font-bold">
                  <span>{referrals?.code || "------"}</span>
                  <button onClick={copyReferralCode} className="text-[#7c93b2] hover:text-white">
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-[#e2ff3b]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsMoreOpen(false)}
              className="w-full bg-[#0a182e] hover:bg-[#0f2444] border border-[#163660] text-white font-bold py-2 rounded-xl text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
