"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Balance, AccountType, User as UserType, AuthenticatedUser } from "@/types";
import { DisplayCurrency, formatMoney, formatSignedMoney } from "@/lib/fx/rates";
import { NavSection } from "@/components/BottomNav";
import { getInitialTheme, applyTheme, Theme } from "@/lib/theme";
import Link from "next/link";
import { CwiLogo } from "@/components/CwiLogo";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpRight,
  FileText,
  Activity,
  Home,
  BookOpen,
  Sparkles,
  Sun,
  Moon,
  TrendingUp,
  Gift,
  User,
  ChevronDown,
  Check,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  DollarSign,
  Headphones,
  Bell,
} from "lucide-react";

interface NavbarProps {
  balance: Balance | null;
  accountType: AccountType;
  onSwitchAccount?: (type: AccountType) => void;
  onOpenDeposit: (initialTab?: "DEPOSIT" | "WITHDRAW") => void;
  onOpenLedger: () => void;
  onGoHome: () => void;
  activeSymbol: string;
  currency: DisplayCurrency;
  onToggleCurrency?: () => void;
  onSelectCurrency?: (currency: DisplayCurrency) => void;
  usdKesRate: number;
  activeSection?: NavSection | "TRADES";
  onSelectSection?: (section: NavSection) => void;
  user?: UserType | AuthenticatedUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  balance,
  onOpenDeposit,
  onOpenLedger,
  onGoHome,
  activeSymbol,
  currency,
  onToggleCurrency,
  onSelectCurrency,
  usdKesRate,
  activeSection = "HOME",
  onSelectSection,
  user,
  onLogout,
}) => {
  const [theme, setTheme] = useState<Theme>("dark");
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isHealthOpen, setIsHealthOpen] = useState(false);

  const currencyRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const healthRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (currencyRef.current && !currencyRef.current.contains(target)) {
        setIsCurrencyOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(target)) {
        setIsAccountOpen(false);
      }
      if (healthRef.current && !healthRef.current.contains(target)) {
        setIsHealthOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCurrencyOpen(false);
        setIsAccountOpen(false);
        setIsHealthOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectCurrency = (newCurrency: DisplayCurrency) => {
    if (onSelectCurrency) {
      onSelectCurrency(newCurrency);
    } else if (onToggleCurrency && newCurrency !== currency) {
      onToggleCurrency();
    }
    setIsCurrencyOpen(false);
  };

  const equity = balance?.equity ?? 0;
  const available = balance?.availableBalance ?? 0;
  const marginUsed = balance?.marginUsed ?? 0;
  const freeMargin = balance?.freeMargin ?? available;
  const marginLevel = balance?.marginLevelPct ?? 0;

  const BASELINE = balance?.totalDeposited ?? available;
  const balanceDelta = available - BASELINE;

  const currentTab = activeSection === "TRADES" ? "TRADE" : activeSection;

  const NAV_LINKS: {
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "HOME", label: "Dashboard", icon: Home },
    { id: "TRADE", label: "Trade", icon: TrendingUp },
    { id: "REFERRAL", label: "Referrals", icon: Gift },
    { id: "PROFILE", label: "Profile", icon: User },
    { id: "MIKE_AI", label: "Mike AI", icon: Sparkles },
  ];

  const userName = user?.name || "Live Trader";
  const userEmail = user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CW";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#142848] bg-[#060c18]/95 dark:bg-[#060c18]/95 light:bg-white/95 backdrop-blur-md transition-colors">
      <div className="max-w-[1920px] mx-auto px-2 sm:px-3 lg:px-4 h-15 flex items-center justify-between gap-3 lg:gap-4">
        {/* ================= LEFT SECTION: Brand & Desktop Navigation ================= */}
        <div className="flex items-center gap-3 lg:gap-5 min-w-0">
          {/* Brand Logo & Live Pill */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onGoHome}
              title="Return to Public Landing Page"
              className="p-0.5 rounded-xl hover:opacity-90 transition-opacity active:scale-95 shrink-0 focus:outline-none focus:ring-2 focus:ring-[#e2ff3b]"
            >
              <CwiLogo size={36} variant="icon" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white dark:text-white light:text-slate-900">
                  CryptoWorld<span className="text-[#e2ff3b]">Investment</span>
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-black tracking-widest uppercase rounded bg-[#071d3a] text-[#38bdf8] border border-[#144588] shadow-xs">
                  CWI
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-black tracking-widest uppercase rounded bg-emerald-950 text-emerald-300 border border-emerald-700/80 shadow-xs">
                  REAL
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black tracking-widest uppercase rounded-full bg-[#e2ff3b]/15 text-[#e2ff3b] border border-[#e2ff3b]/40 shadow-[0_0_10px_rgba(226,255,59,0.2)]">
                  <span className="text-[#e2ff3b] text-[10px]">★</span> VIP TIER
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e2ff3b] animate-pulse shrink-0" />
                <span className="text-slate-400 font-medium hidden sm:inline">Freedom Through Trade</span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="font-mono font-semibold text-[#38bdf8] truncate">
                  {activeSymbol}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          {onSelectSection && (
            <nav
              aria-label="Primary Navigation"
              className="hidden md:flex items-center gap-1 pl-3 lg:pl-4 border-l border-[#142848]"
            >
              {NAV_LINKS.map(({ id, label, icon: Icon }) => {
                const isActive = currentTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => onSelectSection(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[#0c2242] text-[#e2ff3b] border border-[#e2ff3b]/40 shadow-[0_0_15px_rgba(226,255,59,0.15)]"
                        : "text-slate-400 hover:text-white hover:bg-[#091528]"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#e2ff3b]" : ""}`} />
                    <span>{label}</span>
                    {id === "MIKE_AI" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e2ff3b] animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* ================= RIGHT SECTION: Financial Strip + Actions + Dropdowns ================= */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Mobile Fast Navigation: Headset (Support / Mike AI) & Bell (Ledger) */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={() => onSelectSection?.("MIKE_AI")}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-[#0b182d] hover:bg-[#102444] border border-[#142848] text-[#38bdf8] hover:text-[#e2ff3b] transition-all active:scale-95"
              title="Customer Support & Mike AI"
            >
              <Headphones className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenLedger}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-[#0b182d] hover:bg-[#102444] border border-[#142848] text-[#38bdf8] hover:text-[#e2ff3b] transition-all active:scale-95"
              title="Transaction Ledger & Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>

          {/* Compact Financial Status Widget (Desktop) */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3 bg-[#081224] dark:bg-[#081224] light:bg-slate-100 border border-[#142848] dark:border-[#142848] light:border-slate-200 rounded-xl px-2.5 sm:px-3 py-1.5 shadow-inner">
            {/* Available Balance */}
            <div className="flex flex-col min-w-0">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                <Wallet className="w-2.5 h-2.5 text-[#e2ff3b] shrink-0" />
                <span>Available</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black font-mono text-white dark:text-white light:text-slate-950 truncate">
                  {formatMoney(available, currency)}
                </span>
                <span className="hidden xl:inline-block text-[10px] text-[#7c93b2] font-mono">
                  (≈ {currency === "KES" ? `$${available.toFixed(2)} USDT` : `KES ${(available * (usdKesRate || 129.5)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`})
                </span>
                {Math.abs(balanceDelta) > 0.01 && (
                  <span
                    className={`hidden 2xl:inline-block text-[8px] font-black px-1 py-0.2 rounded border ${
                      balanceDelta >= 0
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                    }`}
                  >
                    {formatSignedMoney(balanceDelta, currency)}
                  </span>
                )}
              </div>
            </div>

            <div className="h-5 w-px bg-[#142848] dark:bg-[#142848] light:bg-slate-300" />

            {/* Live Equity */}
            <div className="flex flex-col min-w-0">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                <Activity className="w-2.5 h-2.5 text-[#38bdf8] shrink-0" />
                <span>Equity</span>
              </span>
              <span
                className={`text-xs sm:text-sm font-black font-mono truncate ${
                  equity >= available ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatMoney(equity, currency)}
              </span>
            </div>

            {/* Account Health Pill (Margin & Free Margin Popover) */}
            <div ref={healthRef} className="relative hidden lg:block">
              <button
                onClick={() => setIsHealthOpen((prev) => !prev)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#050b14] dark:bg-[#050b14] light:bg-white border border-[#142848] hover:border-[#0ea5e9]/50 text-[10px] text-slate-300 transition-colors"
                title="View margin health metrics"
              >
                <span className="text-slate-500 uppercase font-bold">Free</span>
                <span className="font-mono text-[#38bdf8] font-bold">
                  {formatMoney(freeMargin, currency)}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isHealthOpen && (
                <div
                  role="tooltip"
                  className="absolute right-0 mt-2 w-56 bg-[#0b1628] border border-[#142848] rounded-xl p-3 shadow-2xl z-50 text-xs space-y-2 animate-fade-in"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-[#142848]">
                    Account Health Details
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Margin Used:</span>
                    <span className="font-mono font-bold text-slate-200">
                      {formatMoney(marginUsed, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Free Margin:</span>
                    <span className="font-mono font-bold text-[#38bdf8]">
                      {formatMoney(freeMargin, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Margin Level:</span>
                    <span
                      className={`font-mono font-bold ${
                        marginLevel > 200 || marginLevel === 0
                          ? "text-emerald-400"
                          : "text-[#e2ff3b]"
                      }`}
                    >
                      {marginLevel > 2000 ? ">2000%" : `${marginLevel.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#142848]">
                    <span className="text-slate-400">Total Deposited:</span>
                    <span className="font-mono font-bold text-slate-300">
                      {formatMoney(BASELINE, currency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action CTAs: Deposit & Withdraw (Desktop) */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => onOpenDeposit("DEPOSIT")}
              className="flex items-center gap-1.5 bg-[#e2ff3b] hover:bg-[#d5f32a] text-[#050b14] font-black px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs shadow-md shadow-[#e2ff3b]/20 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#e2ff3b] shrink-0"
              title="Deposit TRC20 USDT"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden xs:inline">Deposit</span>
            </button>

            <button
              onClick={() => onOpenDeposit("WITHDRAW")}
              className="hidden sm:flex items-center gap-1.5 bg-[#0b172a] hover:bg-[#102342] text-slate-200 hover:text-white border border-[#142848] hover:border-[#1d4278] font-bold px-3 py-1.5 sm:py-2 rounded-xl text-xs transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#38bdf8] shrink-0"
              title="Withdraw TRC20 USDT (Minimum $100.00)"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-[#38bdf8] stroke-[2.5]" />
              <span>Withdraw</span>
            </button>
          </div>

          {/* Currency Dropdown */}
          <div ref={currencyRef} className="relative">
            <button
              onClick={() => setIsCurrencyOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isCurrencyOpen}
              className="flex items-center gap-1 bg-[#0b182d] hover:bg-[#102444] text-slate-200 border border-[#142848] px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#e2ff3b]"
              title={`Display Currency: ${currency}. Click to switch.`}
            >
              <span>{currency}</span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                  isCurrencyOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isCurrencyOpen && (
              <div
                role="listbox"
                className="absolute right-0 mt-2 w-44 bg-[#0b1628] border border-[#142848] rounded-xl p-1.5 shadow-2xl z-50 animate-fade-in"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#142848] mb-1">
                  Display Currency
                </div>
                <button
                  role="option"
                  aria-selected={currency === "USD"}
                  onClick={() => handleSelectCurrency("USD")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    currency === "USD"
                      ? "bg-[#0c2242] text-[#e2ff3b]"
                      : "text-slate-300 hover:bg-[#081224]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold">$</span>
                    <span>USD ($)</span>
                  </div>
                  {currency === "USD" && <Check className="w-3.5 h-3.5 text-[#e2ff3b]" />}
                </button>

                <button
                  role="option"
                  aria-selected={currency === "KES"}
                  onClick={() => handleSelectCurrency("KES")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    currency === "KES"
                      ? "bg-[#0c2242] text-[#e2ff3b]"
                      : "text-slate-300 hover:bg-[#081224]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold">KSh</span>
                    <span>KES (KSh)</span>
                  </div>
                  {currency === "KES" && <Check className="w-3.5 h-3.5 text-[#e2ff3b]" />}
                </button>
                <div className="px-2 pt-1.5 mt-1 border-t border-[#142848] text-[10px] text-slate-400 font-mono">
                  1 USD = {usdKesRate.toFixed(2)} KES
                </div>
              </div>
            )}
          </div>

          {/* Theme Selector Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="flex items-center justify-center h-8 w-8 bg-[#0b182d] hover:bg-[#102444] text-slate-200 border border-[#142848] rounded-xl transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#e2ff3b]"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-[#e2ff3b]" />
            ) : (
              <Moon className="w-4 h-4 text-[#38bdf8]" />
            )}
          </button>

          {/* User Account Menu Dropdown */}
          <div ref={accountRef} className="relative">
            <button
              onClick={() => setIsAccountOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isAccountOpen}
              className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-xl bg-[#0b182d] hover:bg-[#102444] border border-[#142848] transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#e2ff3b]"
              title="Account Menu"
            >
              <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-[#0284c7] via-[#0ea5e9] to-[#1e40af] flex items-center justify-center text-white font-black text-xs shadow-xs">
                {userInitials}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 hidden sm:block transition-transform duration-200 ${
                  isAccountOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isAccountOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 bg-[#0b1628] border border-[#142848] rounded-2xl p-2.5 shadow-2xl z-50 text-xs space-y-1 animate-fade-in"
              >
                {/* User Header */}
                <div className="px-3 py-2 border-b border-[#142848] mb-1">
                  <div className="font-extrabold text-sm text-white truncate">{userName}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {userEmail || "Session Active"}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#071d3a] text-[#38bdf8] border border-[#144588]">
                      REAL • ACTIVE
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#081224] text-emerald-400 border border-emerald-900/60">
                      VERIFIED
                    </span>
                  </div>
                </div>

                {/* Menu Navigation Items */}
                {onSelectSection && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      onSelectSection("PROFILE");
                      setIsAccountOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-left"
                  >
                    <User className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold">My Profile &amp; Settings</span>
                  </button>
                )}

                {/* Sign Out */}
                {onLogout && (
                  <div className="pt-1 border-t border-slate-800/80 mt-1">
                    <button
                      role="menuitem"
                      onClick={() => {
                        setIsAccountOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors text-left font-bold"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
