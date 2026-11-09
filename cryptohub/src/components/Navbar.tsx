"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Balance, AccountType, User as UserType, AuthenticatedUser } from "@/types";
import { DisplayCurrency, formatMoney, formatSignedMoney } from "@/lib/fx/rates";
import { NavSection } from "@/components/BottomNav";
import { getInitialTheme, applyTheme, Theme } from "@/lib/theme";
import Link from "next/link";
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
  const userEmail = user?.email || "trader@cryptohub.io";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CH";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0b0e14]/95 dark:bg-[#0b0e14]/95 light:bg-white/95 backdrop-blur-md transition-colors">
      <div className="max-w-[1920px] mx-auto px-2 sm:px-3 lg:px-4 h-15 flex items-center justify-between gap-3 lg:gap-4">
        {/* ================= LEFT SECTION: Brand & Desktop Navigation ================= */}
        <div className="flex items-center gap-3 lg:gap-5 min-w-0">
          {/* Brand Logo & Live Pill */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onGoHome}
              title="Return to Public Landing Page"
              className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-sm tracking-wider hover:opacity-90 transition-opacity active:scale-95 shrink-0 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              CH
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-base tracking-tight text-white dark:text-white light:text-slate-900">
                  Crypto<span className="text-cyan-400">Hub</span>
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-black tracking-widest uppercase rounded bg-emerald-950 text-emerald-300 border border-emerald-700/80 shadow-xs">
                  REAL
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black tracking-widest uppercase rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 text-amber-300 border border-amber-400/40 shadow-xs">
                  <span className="text-amber-400 text-[10px]">★</span> VIP TIER
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-slate-400 font-medium hidden sm:inline">Live Feed</span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="font-mono font-semibold text-emerald-400 truncate">
                  {activeSymbol}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          {onSelectSection && (
            <nav
              aria-label="Primary Navigation"
              className="hidden md:flex items-center gap-1 pl-3 lg:pl-4 border-l border-slate-800/80"
            >
              {NAV_LINKS.map(({ id, label, icon: Icon }) => {
                const isActive = currentTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => onSelectSection(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-xs"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : ""}`} />
                    <span>{label}</span>
                    {id === "MIKE_AI" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
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
              className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95"
              title="Customer Support & Mike AI"
            >
              <Headphones className="w-4 h-4 text-slate-300" />
            </button>
            <button
              onClick={onOpenLedger}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95"
              title="Transaction Ledger & Notifications"
            >
              <Bell className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          {/* Compact Financial Status Widget (Desktop) */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3 bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-100 border border-slate-800/90 dark:border-slate-800/90 light:border-slate-200 rounded-xl px-2.5 sm:px-3 py-1.5 shadow-inner">
            {/* Available Balance */}
            <div className="flex flex-col min-w-0">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                <Wallet className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                <span>Available</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black font-mono text-white dark:text-white light:text-slate-950 truncate">
                  {formatMoney(available, currency)}
                </span>
                {Math.abs(balanceDelta) > 0.01 && (
                  <span
                    className={`hidden xl:inline-block text-[8px] font-black px-1 py-0.2 rounded border ${
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

            <div className="h-5 w-px bg-slate-800 dark:bg-slate-800 light:bg-slate-300" />

            {/* Live Equity */}
            <div className="flex flex-col min-w-0">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                <Activity className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
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
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/70 dark:bg-slate-950/70 light:bg-white border border-slate-800 hover:border-slate-700 text-[10px] text-slate-300 transition-colors"
                title="View margin health metrics"
              >
                <span className="text-slate-500 uppercase font-bold">Free</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {formatMoney(freeMargin, currency)}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isHealthOpen && (
                <div
                  role="tooltip"
                  className="absolute right-0 mt-2 w-56 bg-[#111726] border border-slate-700 rounded-xl p-3 shadow-xl z-50 text-xs space-y-2 animate-fade-in"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800">
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
                    <span className="font-mono font-bold text-cyan-400">
                      {formatMoney(freeMargin, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Margin Level:</span>
                    <span
                      className={`font-mono font-bold ${
                        marginLevel > 200 || marginLevel === 0
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {marginLevel > 2000 ? ">2000%" : `${marginLevel.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/80">
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
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 shrink-0"
              title="Deposit TRC20 USDT"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden xs:inline">Deposit</span>
            </button>

            <button
              onClick={() => onOpenDeposit("WITHDRAW")}
              className="hidden sm:flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 font-bold px-3 py-1.5 sm:py-2 rounded-xl text-xs transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-400 shrink-0"
              title="Withdraw TRC20 USDT (Minimum $100.00)"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
              <span>Withdraw</span>
            </button>
          </div>

          {/* Currency Dropdown */}
          <div ref={currencyRef} className="relative">
            <button
              onClick={() => setIsCurrencyOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isCurrencyOpen}
              className="flex items-center gap-1 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
                className="absolute right-0 mt-2 w-44 bg-[#111726] border border-slate-700 rounded-xl p-1.5 shadow-2xl z-50 animate-fade-in"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
                  Display Currency
                </div>
                <button
                  role="option"
                  aria-selected={currency === "USD"}
                  onClick={() => handleSelectCurrency("USD")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    currency === "USD"
                      ? "bg-cyan-500/15 text-cyan-400"
                      : "text-slate-300 hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold">$</span>
                    <span>USD ($)</span>
                  </div>
                  {currency === "USD" && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>

                <button
                  role="option"
                  aria-selected={currency === "KES"}
                  onClick={() => handleSelectCurrency("KES")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    currency === "KES"
                      ? "bg-cyan-500/15 text-cyan-400"
                      : "text-slate-300 hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold">KSh</span>
                    <span>KES (KSh)</span>
                  </div>
                  {currency === "KES" && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
                <div className="px-2 pt-1.5 mt-1 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
                  1 USD = {usdKesRate.toFixed(2)} KES
                </div>
              </div>
            )}
          </div>

          {/* Theme Selector Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="flex items-center justify-center h-8 w-8 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 rounded-xl transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-cyan-400" />
            )}
          </button>

          {/* User Account Menu Dropdown */}
          <div ref={accountRef} className="relative">
            <button
              onClick={() => setIsAccountOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isAccountOpen}
              className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              title="Account Menu"
            >
              <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-xs">
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
                className="absolute right-0 mt-2 w-64 bg-[#111726] border border-slate-700 rounded-2xl p-2.5 shadow-2xl z-50 text-xs space-y-1 animate-fade-in"
              >
                {/* User Header */}
                <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                  <div className="font-extrabold text-sm text-white truncate">{userName}</div>
                  <div className="text-[11px] text-slate-400 truncate">{userEmail}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                      REAL • ACTIVE
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                      KYC {user?.kycStatus || "VERIFIED"}
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

                <button
                  role="menuitem"
                  onClick={() => {
                    onOpenLedger();
                    setIsAccountOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-left"
                >
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold">Double-Entry Audit Ledger</span>
                </button>

                <Link
                  href="/api-docs"
                  role="menuitem"
                  onClick={() => setIsAccountOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-left"
                >
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold">Swagger API Docs</span>
                </Link>

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
