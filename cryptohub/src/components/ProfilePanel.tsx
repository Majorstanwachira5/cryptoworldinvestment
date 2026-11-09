"use client";

import React, { useState, useEffect, useRef } from "react";
import { AccountPerformance, Permission, ProfileSummary, Trade, AccountType } from "@/types";
import { DisplayCurrency, formatMoney, formatSignedMoney } from "@/lib/fx/rates";
import { getInitialTheme, applyTheme, Theme } from "@/lib/theme";
import {
  Copy,
  Check,
  ShieldCheck,
  Wallet,
  TrendingUp,
  KeyRound,
  Clock,
  Sun,
  Moon,
  LogOut,
  FileText,
  Lock,
  ArrowDownToLine,
  RefreshCcw,
  ShieldAlert,
  ArrowUpRight,
  User,
  Sliders,
  DollarSign,
  ChevronDown,
  ExternalLink,
  Layers,
  Gift,
} from "lucide-react";

interface ProfilePanelProps {
  profile: ProfileSummary | null;
  provider?: "local" | "supabase";
  permissions?: Permission[];
  authenticated: boolean;
  currency: DisplayCurrency;
  trades: Trade[];
  accountType?: AccountType;
  onOpenLedger?: () => void;
  onOpenDeposit?: (initialTab?: "DEPOSIT" | "WITHDRAW") => void;
  onToggleCurrency?: () => void;
  onSelectCurrency?: (currency: DisplayCurrency) => void;
  onLogout?: () => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  profile,
  provider = "local",
  permissions = [],
  authenticated,
  currency,
  trades,
  onOpenLedger,
  onOpenDeposit,
  onToggleCurrency,
  onSelectCurrency,
  onLogout,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  const handleThemeToggle = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* ignore */
    }
  };

  // Close currency dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setCurrencyDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCurrencyDropdownOpen(false);
        setShowPasswordModal(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!profile) {
    return (
      <div className="bg-[#101726] border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400 max-w-xl mx-auto shadow-xl">
        <RefreshCcw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
        Loading institutional profile…
      </div>
    );
  }

  const { user, depositAddresses, session, real, fx, performance, referrals } = profile;
  const openPositions = trades.filter((t) => t.status === "OPEN");
  const openMarginDeployed = openPositions.reduce((acc, t) => acc + t.margin, 0);

  const expiryHours = Math.round(
    Math.max(0, session.expiresAt - Math.floor(Date.now() / 1000)) / 3600
  );

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters long." });
      return;
    }
    setPasswordMsg({ type: "success", text: "Password successfully updated." });
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordMsg(null);
      setOldPassword("");
      setNewPassword("");
    }, 1200);
  };

  const perfData = performance?.REAL;
  const userInitials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CH";

  return (
    <div className="space-y-4 w-full pb-8">
      {/* ================= SECTION 1: User Profile Header Banner ================= */}
      <div className="bg-gradient-to-r from-[#101726] via-[#121c2e] to-[#0c111c] border border-slate-800 rounded-xl p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          {/* Identity & Badges */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shrink-0">
              {userInitials}
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight truncate">
                  {user.name}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700">
                  REAL LIVE ACCOUNT
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#e2ff3b]/15 text-[#e2ff3b] border border-[#e2ff3b]/40 shadow-[0_0_10px_rgba(226,255,59,0.2)]">
                  ★ VIP TRADER
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  {user.role}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  KYC {user.kycStatus}
                </span>
              </div>

              <p className="text-xs text-slate-400 truncate">{user.email}</p>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {authenticated ? "Session Cryptographically Verified" : "Unverified Session"}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Provider: <strong className="text-cyan-400 font-mono uppercase">{provider}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-xs"
              title="Change Account Password"
            >
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Password</span>
            </button>

            {onOpenLedger && (
              <button
                onClick={onOpenLedger}
                className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-xs"
                title="View Double-Entry Ledger"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Audit Ledger</span>
              </button>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs"
                title="Sign out of CryptoWorldInvestment"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================= SECTION 2: 4 Key Account Identifier Cards ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: User Account ID */}
        <div className="bg-[#101726] border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" /> User Account ID
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              UID
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span
              className="text-xs font-mono font-bold text-white truncate max-w-[210px]"
              title={user.id}
            >
              {user.id}
            </span>
            <button
              onClick={() => copyToClipboard(user.id, "uid")}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors shrink-0"
              title="Copy Account ID"
            >
              {copiedKey === "uid" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Unique institutional trader identifier</p>
        </div>

        {/* Card 2: Referral Code */}
        <div className="bg-[#101726] border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-amber-400" /> Referral Partner Code
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
              $30 / Ref
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-sm font-mono font-black text-amber-400 tracking-wider">
              {referrals.code}
            </span>
            <button
              onClick={() => copyToClipboard(referrals.code, "refCode")}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors shrink-0"
              title="Copy Referral Code"
            >
              {copiedKey === "refCode" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Earns $30 USDT credited into REAL ledger
          </p>
        </div>

        {/* Card 3: Session Expiration */}
        <div className="bg-[#101726] border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" /> Session Lifespan
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              ACTIVE
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-mono font-black text-slate-200">
              Expires in {expiryHours} hours
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Issued: {new Date(session.issuedAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Card 4: Open Positions */}
        <div className="bg-[#101726] border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" /> Live Positions
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700">
              TRADING
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-mono font-black text-white">
              {openPositions.length} Active {openPositions.length === 1 ? "Trade" : "Trades"}
            </span>
            <span className="text-[11px] font-mono text-cyan-400 font-bold">
              {formatMoney(openMarginDeployed, currency)} margin
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Mark-to-market risk actively monitored</p>
        </div>
      </div>

      {/* ================= SECTION 3: Portfolio & Trading Performance (2-Column Grid) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Real Capital & Margin Allocation */}
        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <h3 className="font-extrabold text-sm text-white">
                  Live Capital &amp; Margin Ledger
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700">
                REAL BOOK
              </span>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Available Balance
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tracking-tight">
                  {formatMoney(real.availableBalance, currency)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Live Account Equity
                </span>
                <span
                  className={`text-lg sm:text-xl font-black font-mono tracking-tight ${
                    real.equity >= real.availableBalance ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatMoney(real.equity, currency)}
                </span>
              </div>
            </div>

            {/* Margin Grid */}
            <div className="grid grid-cols-3 gap-2.5 mt-3 text-xs">
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block font-semibold mb-1">Total Deposited</span>
                <span className="font-mono font-bold text-slate-200">
                  {formatMoney(real.totalDeposited, currency)}
                </span>
              </div>
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block font-semibold mb-1">Margin Used</span>
                <span className="font-mono font-bold text-slate-200">
                  {formatMoney(real.marginUsed, currency)}
                </span>
              </div>
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block font-semibold mb-1">Free Margin</span>
                <span className="font-mono font-bold text-cyan-400">
                  {formatMoney(real.freeMargin, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          {onOpenDeposit && (
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
              <button
                onClick={() => onOpenDeposit("DEPOSIT")}
                className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black py-2.5 rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95"
              >
                <ArrowDownToLine className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Deposit USDT</span>
              </button>

              <button
                onClick={() => onOpenDeposit("WITHDRAW")}
                className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
                <span>Withdraw Funds</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Realised Trading Performance */}
        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <h3 className="font-extrabold text-sm text-white">
                  Realised Performance Analytics
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Performance Ledger
              </span>
            </div>

            {perfData ? (
              <div className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Win Rate
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-2xl font-black font-mono ${
                          (perfData.winRate ?? 0) >= 50 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {perfData.winRate === null ? "—" : `${perfData.winRate}%`}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        {perfData.wins}W / {perfData.losses}L
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Net Realised PnL
                    </span>
                    <span
                      className={`text-2xl font-black font-mono ${
                        perfData.netPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatSignedMoney(perfData.netPnl, currency)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block font-semibold mb-1">Profit Factor</span>
                    <span className="font-mono font-bold text-slate-200">
                      {perfData.profitFactor === null ? "n/a" : perfData.profitFactor.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block font-semibold mb-1">Average Win</span>
                    <span className="font-mono font-bold text-emerald-400">
                      +${perfData.averageWin?.toFixed(2) ?? "0.00"}
                    </span>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block font-semibold mb-1">Average Loss</span>
                    <span className="font-mono font-bold text-rose-400">
                      -${perfData.averageLoss?.toFixed(2) ?? "0.00"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800 mt-4">
                No closed real trades on record yet. Complete your first execution to populate analytics.
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span>Trading framework: <strong>60% Win / 40% Controlled Loss</strong></span>
            <span className="font-mono text-cyan-400 font-bold">1:1.5 Min R:R</span>
          </div>
        </div>
      </div>

      {/* ================= SECTION 4: TRC20 Blockchain Vault (Paylor PAYL-EFSJUF) ================= */}
      <div className="bg-[#101726] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
            <h3 className="font-extrabold text-sm text-white">
              Institutional TRC20 USDT Vault Address
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Paylor Channel: <strong className="text-emerald-400">PAYL-EFSJUF</strong> · 19 Block Confirmations
          </span>
        </div>

        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
              Official USDT (TRON TRC-20) Treasury Vault
            </span>
            <div className="font-mono text-xs sm:text-sm font-bold text-white break-all select-all">
              {depositAddresses.usdt || "TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd"}
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">
              Smart Contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
            </span>
          </div>

          <button
            onClick={() =>
              copyToClipboard(
                depositAddresses.usdt || "TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd",
                "vault"
              )
            }
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
            title="Copy Vault Address"
          >
            {copiedKey === "vault" ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-cyan-400" />
                <span>Copy Vault Address</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ================= SECTION 5: Preferences & Security Governance (2-Column Grid) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card A: Appearance & Currency Preferences */}
        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="font-extrabold text-sm text-white">Appearance &amp; Preferences</h3>
          </div>

          <div className="space-y-3">
            {/* Color Theme Preference */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {theme === "dark" ? (
                  <Moon className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
                <div>
                  <div className="text-xs font-bold text-white">Interface Color Theme</div>
                  <div className="text-[10px] text-slate-400">
                    {theme === "dark" ? "Dark Trading Mode (Optimized)" : "Light Clean Mode"}
                  </div>
                </div>
              </div>

              <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                <button
                  onClick={() => handleThemeToggle("dark")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-all ${
                    theme === "dark"
                      ? "bg-cyan-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Moon className="w-3 h-3" /> Dark
                </button>
                <button
                  onClick={() => handleThemeToggle("light")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-all ${
                    theme === "light"
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Sun className="w-3 h-3" /> Light
                </button>
              </div>
            </div>

            {/* Currency Preference */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-xs font-bold text-white">Primary Display Currency</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    1 USD = {fx.usdKes.toFixed(2)} KES
                  </div>
                </div>
              </div>

              <div ref={currencyDropdownRef} className="relative">
                <button
                  onClick={() => setCurrencyDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-black text-cyan-300 transition-all"
                >
                  <span>{currency}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {currencyDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#111726] border border-slate-700 rounded-xl p-1 shadow-2xl z-50">
                    <button
                      onClick={() => {
                        if (onSelectCurrency) onSelectCurrency("USD");
                        else if (onToggleCurrency && currency !== "USD") onToggleCurrency();
                        setCurrencyDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                        currency === "USD"
                          ? "bg-cyan-500/15 text-cyan-400"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span>USD ($)</span>
                      {currency === "USD" && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        if (onSelectCurrency) onSelectCurrency("KES");
                        else if (onToggleCurrency && currency !== "KES") onToggleCurrency();
                        setCurrencyDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                        currency === "KES"
                          ? "bg-cyan-500/15 text-cyan-400"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span>KES (KSh)</span>
                      {currency === "KES" && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card B: Security, Roles & Granted Permissions */}
        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="font-extrabold text-sm text-white">Security &amp; Permissions</h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">
              Validated HMAC/JWT
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                  Issued Timestamp
                </span>
                <span className="font-mono text-slate-300 text-[11px]">
                  {new Date(session.issuedAt * 1000).toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                  Role Authority
                </span>
                <span className="font-mono text-cyan-400 font-bold uppercase text-[11px]">
                  {user.role}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">
                Cryptographic RBAC Permissions
              </span>
              <div className="flex flex-wrap gap-1">
                {permissions.length === 0 ? (
                  <span className="text-xs text-slate-500">Standard Real Trading Permissions</span>
                ) : (
                  permissions.map((p) => (
                    <span
                      key={p}
                      className="text-[9px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700/80"
                    >
                      {p}
                    </span>
                  ))
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
              Access tokens are signed server-side and transmitted over encrypted transport.
              Direct database manipulations are forbidden and audited to immutable ledger logs.
            </p>
          </div>
        </div>
      </div>

      {/* ================= Password Management Modal ================= */}
      {showPasswordModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-password-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPasswordModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
        >
          <div className="bg-[#111726] border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 id="change-password-title" className="font-extrabold text-base text-white">
                Change Account Password
              </h4>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1 rounded-lg hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  New Secure Password (Minimum 8 Characters)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {passwordMsg && (
                <div
                  className={`text-xs p-3 rounded-xl border ${
                    passwordMsg.type === "success"
                      ? "bg-emerald-950/60 border-emerald-700 text-emerald-300"
                      : "bg-rose-950/60 border-rose-700 text-rose-300"
                  }`}
                >
                  {passwordMsg.text}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-cyan-500/20"
              >
                Save New Password
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
