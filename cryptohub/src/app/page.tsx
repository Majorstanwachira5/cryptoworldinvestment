"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ToastProvider, useToast } from "@/components/Toast";
import { LandingHero } from "@/components/LandingHero";
import { Navbar } from "@/components/Navbar";
import { AssetSelector } from "@/components/AssetSelector";
import { TradingViewChart } from "@/components/TradingViewChart";
import { TradeTicket } from "@/components/TradeTicket";
import { PredictionPanel } from "@/components/PredictionPanel";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { BottomNav, NavSection } from "@/components/BottomNav";
import { SessionProvider, useSession } from "@/components/SessionProvider";
import { authFetch, UnauthorizedError } from "@/lib/auth/session";
import { TradesPanel } from "@/components/TradesPanel"; // available for future use
import { ReferralPanel } from "@/components/ReferralPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { HomeDashboard } from "@/components/HomeDashboard";
import { MikeTradesChat } from "@/components/MikeTradesChat";
import { FloatingMikeButton } from "@/components/FloatingMikeButton";
import { DisplayCurrency } from "@/lib/fx/rates";
import { PositionsTable } from "@/components/PositionsTable";
import { DepositModal } from "@/components/DepositModal";
import { LedgerModal } from "@/components/LedgerModal";
import { AuthModal } from "@/components/AuthModal";
import { DEFAULT_ASSETS } from "@/lib/market/assets";
import {
  MarketAsset,
  Candle,
  Balance,
  User,
  Trade,
  PredictionResult,
  AnalysisReport,
  ProfileResponse,
  ReferralStats,
  AccountType,
} from "@/types";
import confetti from "canvas-confetti";

function TradingPlatformContent() {
  const session = useSession();
  const { isAuthenticated, status: sessionStatus, requestAccountAccess } = session;

  const [view, setView] = useState<"LANDING" | "TERMINAL">("LANDING");
  // Section shown inside the terminal. LANDING and HOME are distinct: the
  // public marketing page is not the same surface as the trading dashboard.
  const [section, setSection] = useState<NavSection>("HOME");
  const [currency, setCurrency] = useState<DisplayCurrency>("KES");
  const [usdKesRate, setUsdKesRate] = useState<number>(129.5);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [referrals, setReferrals] = useState<ReferralStats | null>(null);
    const [accountType, setAccountType] = useState<AccountType>("REAL");

  const [assets, setAssets] = useState<MarketAsset[]>(DEFAULT_ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<MarketAsset>(DEFAULT_ASSETS[0]);
  const [timeframe, setTimeframe] = useState<string>("1H");
  const [candles, setCandles] = useState<Candle[]>([]);

  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predictionLoading, setPredictionLoading] = useState<boolean>(false);
  const [prefilledPrediction, setPrefilledPrediction] = useState<PredictionResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);

  // Guard set to prevent duplicate auto-close calls for the same trade
  const closingTradeIds = React.useRef<Set<string>>(new Set());
  // Mirror trades and accountType in refs so tick engine and async handlers always see latest
  const tradesRef = React.useRef<Trade[]>([]);
  const accountTypeRef = React.useRef<AccountType>("REAL");
  const selectedAssetRef = React.useRef(selectedAsset);

  // Keep refs synchronized
  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { accountTypeRef.current = accountType; }, [accountType]);
  useEffect(() => { selectedAssetRef.current = selectedAsset; }, [selectedAsset]);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositModalTab, setDepositModalTab] = useState<"DEPOSIT" | "WITHDRAW" | "HISTORY">("DEPOSIT");
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);

  const handleOpenDepositModal = (tab: "DEPOSIT" | "WITHDRAW" | "HISTORY" = "DEPOSIT") => {
    setDepositModalTab(tab);
    setIsDepositOpen(true);
  };
  // Mobile-only trade section tab (controls which panel is visible on small screens)
  const [mobileTradeTab, setMobileTradeTab] = useState<"chart" | "order" | "signals" | "positions">("chart");


  const { showToast } = useToast();

  // Which feed the current series came from, and whether it is a live print or
  // a delayed reference rate. Surfaced in the UI rather than assumed.
  const [marketDelayed, setMarketDelayed] = useState<boolean>(true);

  /** The interval the feed actually returned, and whether it matched the request. */
  const [candleResolution, setCandleResolution] = useState<{
    interval: string;
    honoured: boolean;
  }>({ interval: "", honoured: true });

  /** Refreshes prices for every instrument so the lists stay live. */
  const fetchTicker = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authFetch("/api/market/ticker");
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data.assets)) return;

      setAssets(data.assets);
      setSelectedAsset((prev) => {
        const live = data.assets.find((a: MarketAsset) => a.symbol === prev.symbol);
        return live ? { ...live, currentPrice: prev.currentPrice || live.currentPrice } : prev;
      });
    } catch (err) {
      console.error("Failed to load ticker:", err);
    }
  }, [isAuthenticated]);

  // Real market data.
  //
  // Candles and prices come from /api/market, which resolves them from Binance
  // for crypto and from a configured intraday feed for forex. They used to be
  // generated locally by a seeded random walk anchored to a hardcoded price.
  const fetchMarketSeries = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const res = await authFetch(
        `/api/market/candles?symbol=${encodeURIComponent(selectedAsset.symbol)}&timeframe=${encodeURIComponent(timeframe)}`
      );
      if (!res.ok) return;

      const data = await res.json();
      if (!Array.isArray(data.candles)) return;

      setCandles(data.candles);
      setMarketDelayed(Boolean(data.delayed));
      // A daily reference series drawn under a 1H label would misrepresent its
      // resolution, so the chart states the interval it actually received.
      setCandleResolution({
        interval: data.interval,
        honoured: data.timeframeHonoured !== false,
      });

      // Keep the selected asset's live price in step with the series.
      if (typeof data.price === "number" && Number.isFinite(data.price)) {
        selectedAssetRef.current = { ...selectedAssetRef.current, currentPrice: data.price };
        setSelectedAsset((prev) => ({ ...prev, currentPrice: data.price }));
        setAssets((prev) =>
          prev.map((a) => (a.symbol === data.symbol ? { ...a, currentPrice: data.price } : a))
        );
      }
    } catch (err) {
      console.error("Failed to load market series:", err);
    }
  }, [isAuthenticated, selectedAsset.symbol, timeframe]);

  // Load candles whenever the instrument or timeframe changes, and once the
  // session exists.
  useEffect(() => {
    fetchMarketSeries();
  }, [fetchMarketSeries]);

  // Fetch Balance & User Profile for specified accountType
  const fetchBalanceAndUser = useCallback(
    async (type?: AccountType) => {
      if (!isAuthenticated) return;
      const targetType = type || accountTypeRef.current;
      try {
        const res = await authFetch(`/api/ledger/balance?account_type=${targetType}`);
        const data = await res.json();
        if (data.user) setUser(data.user);
        if (data.balance) {
          setBalance(data.balance);
          setProfile((prev) => (prev ? { ...prev, real: data.balance } : prev));
        }
      } catch (err) {
        console.error("Failed to fetch balance:", err);
      }
    },
    [isAuthenticated]
  );

  // Refresh the live quote on a short interval so the header price tracks the
  // market. The series itself only changes when the instrument or timeframe
  // changes, which keeps the user's zoom intact.
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setInterval(() => {
      fetchTicker();
      fetchBalanceAndUser();
    }, 15000);
    return () => clearInterval(timer);
  }, [isAuthenticated, fetchTicker, fetchBalanceAndUser]);

  // Fetch Positions for specified accountType
  const fetchPositions = useCallback(
    async (type?: AccountType) => {
      if (!isAuthenticated) return;
      const targetType = type || accountTypeRef.current;
      try {
        const res = await authFetch(`/api/trade/positions?account_type=${targetType}`);
        const data = await res.json();
        const newTrades = data.trades || [];
        setTrades(newTrades);
        tradesRef.current = newTrades;
        if (data.balance) {
          setBalance(data.balance);
          setProfile((prev) => (prev ? { ...prev, real: data.balance } : prev));
        }
      } catch (err) {
        console.error("Failed to fetch positions:", err);
      }
    },
    [isAuthenticated]
  );

  // Fetch Quantitative Prediction (Silent mode does not trigger loading spinner)
  const fetchPrediction = useCallback(
    async (silent: boolean = false) => {
      if (!isAuthenticated) return;
      if (!silent) setPredictionLoading(true);
      try {
        const curPrice = selectedAssetRef.current?.currentPrice || selectedAsset.currentPrice;
        const currentSym = selectedAssetRef.current?.symbol || selectedAsset.symbol;
        const activeAcct = accountTypeRef.current;
        const res = await authFetch(
          `/api/predict?symbol=${currentSym}&timeframe=${timeframe}&account_type=${activeAcct}&current_price=${curPrice}`
        );
        const data = await res.json();
        setPrediction(data);
      } catch (err) {
        console.error("Failed to fetch prediction:", err);
      } finally {
        if (!silent) setPredictionLoading(false);
      }
    },
    [isAuthenticated, selectedAsset.symbol, selectedAsset.currentPrice, timeframe]
  );

  // Fetch the full analysis report (indicators, structure, sizing, replay stats)
  const fetchAnalysis = useCallback(
    async (silent: boolean = false) => {
      if (!isAuthenticated) return;
      if (!silent) setAnalysisLoading(true);
      try {
        const curPrice = selectedAssetRef.current?.currentPrice || selectedAsset.currentPrice;
        const currentSym = selectedAssetRef.current?.symbol || selectedAsset.symbol;
        const activeAcct = accountTypeRef.current;
        const res = await authFetch(
          `/api/analysis?symbol=${currentSym}&timeframe=${timeframe}&account_type=${activeAcct}&current_price=${curPrice}`
        );
      if (!res.ok) throw new Error(`Analysis request failed: ${res.status}`);
      const data = await res.json();
      setAnalysis(data);
      } catch (err) {
        console.error("Failed to fetch analysis:", err);
      } finally {
        if (!silent) setAnalysisLoading(false);
      }
    },
    [isAuthenticated, selectedAsset.symbol, selectedAsset.currentPrice, timeframe]
  );

  // Fetch profile (session, balances, performance, referral summary) and referrals
  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authFetch("/api/profile");
      if (!res.ok) return;
      const data = await res.json();
      setProfile(data);
      if (data.real) setBalance(data.real);
      if (data.fx?.usdKes) setUsdKesRate(data.fx.usdKes);
    } catch (err) {
      // A rejected token means the session died; send the user back to sign-in
      // rather than leaving the terminal in a half-authenticated state.
      if (err instanceof UnauthorizedError) {
        showToast("warning", "Session Expired", "Please sign in again to continue.");
      } else {
        console.error("Failed to fetch profile:", err);
      }
    }
  }, [isAuthenticated]);

  const fetchReferrals = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authFetch("/api/referrals");
      if (!res.ok) return;
      const data = await res.json();
      setReferrals(data.referrals);
    } catch (err) {
      console.error("Failed to fetch referrals:", err);
    }
  }, [isAuthenticated]);

  // Initial and on-account-switch sync. Every one of these endpoints is behind
  // an access token, so nothing is requested until a session has been restored.
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchBalanceAndUser(accountType);
    fetchPositions(accountType);
    fetchPrediction(false);
    fetchAnalysis(false);
    fetchProfile();
    fetchReferrals();
  }, [
    isAuthenticated,
    accountType,
    fetchBalanceAndUser,
    fetchPositions,
    fetchPrediction,
    fetchAnalysis,
    fetchProfile,
    fetchReferrals,
  ]);

  // Refetch prediction when timeframe or symbol changes
  useEffect(() => {
    fetchPrediction(false);
    fetchAnalysis(false);
  }, [selectedAsset.symbol, timeframe, fetchPrediction, fetchAnalysis]);

  // Silent analysis refresh. Slower than the price feed because the indicator
  // stack and the strategy replay cost far more than a quote lookup.
  useEffect(() => {
    const timer = setInterval(() => {
      fetchAnalysis(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchAnalysis]);

  // Periodic silent refresh of prediction every 10s to keep market confluence fresh
  useEffect(() => {
    const timer = setInterval(() => {
      fetchPrediction(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [fetchPrediction]);

  // Live price feed and mark-to-market.
  //
  // Prices are read from the market feed, not generated locally. This engine
  // previously produced its own movement with a random walk, and on DEMO
  // accounts that walk was rigged: each trade was assigned an outcome from a
  // hash of its id at 80% win / 20% loss, winning positions were steered toward
  // take profit, and an explicit clamp stopped the price ever reaching the stop
  // loss on a "winning" trade. That has been removed. Positions now mark to
  // market on real quotes and auto TP/SL fires only when the market actually
  // reaches the level.
  useEffect(() => {
    let cancelled = false;
    const symbol = selectedAsset.symbol;
    const digits = selectedAsset.digits;

    async function pollPrice() {
      let price: number | undefined;

      try {
        const res = await authFetch("/api/market/ticker");
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data.assets)) return;
        const match = data.assets.find((a: MarketAsset) => a.symbol === symbol);
        if (!match) return;

        const next = match.currentPrice;
        if (cancelled || typeof next !== "number" || !Number.isFinite(next)) return;

        price = next;
        setAssets(data.assets);
        setSelectedAsset((prev) =>
          prev.symbol === symbol ? { ...prev, currentPrice: next } : prev
        );
        setMarketDelayed(Boolean(data.delayed?.includes(symbol)));
      } catch (err) {
        // A feed outage must not invent a price. The last known quote stands
        // until the next successful read.
        console.warn("Price poll failed:", err);
        return;
      }

      if (cancelled || price === undefined) return;

      const newPrice = Number(Math.max(0.0001, price).toFixed(digits));
      const currentAccountType = accountTypeRef.current;

      // Update the live bar so the chart's most recent candle tracks the quote.
      setCandles((prevCandles) => {
        if (prevCandles.length === 0) return prevCandles;
        const lastCandle = { ...prevCandles[prevCandles.length - 1] };
        lastCandle.close = newPrice;
        if (newPrice > lastCandle.high) lastCandle.high = newPrice;
        if (newPrice < lastCandle.low) lastCandle.low = newPrice;
        return [...prevCandles.slice(0, -1), lastCandle];
      });

      // Update last candle bar
      setCandles((prevCandles) => {
        if (prevCandles.length === 0) return prevCandles;
        const lastCandle = { ...prevCandles[prevCandles.length - 1] };
        lastCandle.close = newPrice;
        if (newPrice > lastCandle.high) lastCandle.high = newPrice;
        if (newPrice < lastCandle.low) lastCandle.low = newPrice;
        return [...prevCandles.slice(0, -1), lastCandle];
      });

      // Mark-to-market: update PnL, check auto TP/SL hits, and update live equity
      setTrades((prevTrades) => {
        let openUnrealizedPnl = 0;
        let openMarginUsed = 0;

        const updated = prevTrades.map((t) => {
          if (t.status === "OPEN" && t.symbol === selectedAsset.symbol) {
            const priceDiff =
              t.direction === "LONG"
                ? newPrice - t.entryPrice
                : t.entryPrice - newPrice;

            let pnl = 0;
            let pips = 0;

            if (t.assetClass === "FOREX") {
              const pipSize = t.symbol.includes("JPY") ? 0.01 : 0.0001;
              pips = Math.round((priceDiff / pipSize) * 10) / 10;
              const pipValue = t.symbol.includes("JPY") ? 1000 / newPrice : 10.0;
              pnl = Math.round(pips * pipValue * t.size * 100) / 100;
            } else {
              pnl = Math.round(priceDiff * t.size * 100) / 100;
            }

            // --- AUTO TAKE PROFIT ---
            const reachedTP =
              t.takeProfit &&
              ((t.direction === "LONG" && newPrice >= t.takeProfit) ||
                (t.direction === "SHORT" && newPrice <= t.takeProfit));

            if (reachedTP && !closingTradeIds.current.has(t.id)) {
              closingTradeIds.current.add(t.id);
              const exitP = t.takeProfit!;
              setTimeout(() => {
                handleCloseTrade(t.id, exitP);
                closingTradeIds.current.delete(t.id);
                confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
                showToast(
                  "success",
                  "🎯 Big Margin Profit Realized!",
                  `+$${Math.abs(pnl).toFixed(2)} profit credited to ${currentAccountType} Balance!`
                );
              }, 60);
            }

            // --- AUTO STOP LOSS ---
            const reachedSL =
              t.stopLoss &&
              ((t.direction === "LONG" && newPrice <= t.stopLoss) ||
                (t.direction === "SHORT" && newPrice >= t.stopLoss));

            if (reachedSL && !closingTradeIds.current.has(t.id)) {
              closingTradeIds.current.add(t.id);
              const exitP = t.stopLoss!;
              setTimeout(() => {
                handleCloseTrade(t.id, exitP);
                closingTradeIds.current.delete(t.id);
                showToast(
                  "warning",
                  "🛡️ Stop Loss Triggered",
                  `-$${Math.abs(pnl).toFixed(2)} loss contained. Risk managed from ${currentAccountType} Balance.`
                );
              }, 60);
            }

            if ((t.accountType || "REAL") === currentAccountType) {
              openUnrealizedPnl += pnl;
              openMarginUsed += t.margin;
            }

            return { ...t, currentPrice: newPrice, pnl, pips };
          } else if (t.status === "OPEN" && (t.accountType || "REAL") === currentAccountType) {
            openUnrealizedPnl += t.pnl;
            openMarginUsed += t.margin;
          }
          return t;
        });

        // Bring platform to life: dynamically update live Equity & Free Margin on Navbar as market ticks
        setBalance((prevBal) => {
          if (!prevBal) return prevBal;
          const liveEquity = Math.round((prevBal.availableBalance + openUnrealizedPnl) * 100) / 100;
          const liveFreeMargin = Math.round((liveEquity - openMarginUsed) * 100) / 100;
          const liveMarginLevelPct =
            openMarginUsed > 0
              ? Math.round((liveEquity / openMarginUsed) * 100 * 100) / 100
              : 9999;
          return {
            ...prevBal,
            equity: liveEquity,
            marginUsed: Math.round(openMarginUsed * 100) / 100,
            freeMargin: liveFreeMargin,
            marginLevelPct: liveMarginLevelPct,
          };
        });

        return updated;
      });
    }

    // Poll often enough to feel live. The server caches quotes for ten seconds,
    // so a shorter client interval would only add requests.
    pollPrice();
    const interval = setInterval(pollPrice, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated, selectedAsset.symbol, selectedAsset.digits]);

  /**
   * Sign out. The token is discarded on the server's terms and here too, and any
   * profile data that belonged to the old identity is dropped from state so it
   * cannot leak into the next session.
   */
  const handleLogout = async () => {
    await session.logout();
    setProfile(null);
    setReferrals(null);
    setBalance(null);
    setTrades([]);
    tradesRef.current = [];
    setPrediction(null);
    setAnalysis(null);
    setAccountType("REAL");
    accountTypeRef.current = "REAL";
    setSection("HOME");
    setView("LANDING");
    showToast("info", "Signed Out", "Your access token has been discarded.");
  };

  const handleAccountDeleted = async () => {
    await handleLogout();
    showToast(
      "info",
      "Account Permanently Deleted",
      "Your credentials, wallet linkage, and trading records have been completely wiped."
    );
  };

  // Account Switching Logic
  //
  // Registration or sign-in is required before either book can be opened. The
  // account the user tried to reach is remembered so they land on it after
  // authenticating.
  const handleSwitchAccount = async (targetType: AccountType) => {
    const allowed = await requestAccountAccess(targetType);
    if (!allowed) {
      setIsAuthOpen(true);
      showToast(
        "info",
        "Sign In Required",
        `Register or sign in to open the ${targetType} account.`
      );
      return;
    }

    setAccountType("REAL");
    accountTypeRef.current = "REAL";
    showToast(
      "info",
      "REAL Account Active",
      "Trading with Live Capital under quantitative risk governance."
    );
  };

  // Strict Multi-Layer Security Gate: Block access to the main dashboard without authenticated backend-issued user ID
  useEffect(() => {
    if (view === "TERMINAL" && (!isAuthenticated || !session.user?.id)) {
      setView("LANDING");
      setIsAuthOpen(true);
    }
  }, [view, isAuthenticated, session.user?.id]);

  /** Entry point used by the landing page buttons. */
  const handleOpenTerminal = async (targetType: AccountType) => {
    const allowed = await requestAccountAccess(targetType);
    if (!allowed || !session.user?.id) {
      setIsAuthOpen(true);
      return;
    }

    setView("TERMINAL");
    setSection("HOME");
    setAccountType("REAL");
    accountTypeRef.current = "REAL";
  };

  // Execute Trade Handler
  const handleExecuteTrade = async (params: {
    accountType: AccountType;
    symbol: string;
    assetClass: "CRYPTO" | "FOREX";
    direction: "LONG" | "SHORT";
    orderType: "MARKET" | "LIMIT";
    size: number;
    leverage: number;
    currentPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    rationale?: string;
  }): Promise<boolean> => {
    try {
      const res = await authFetch("/api/trade/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success) {
        if (data.balance) {
          setBalance(data.balance);
        }
        if (data.trade) {
          setTrades((prev) => [data.trade, ...prev]);
          tradesRef.current = [data.trade, ...tradesRef.current];
        }
        await fetchPositions(params.accountType);
        showToast(
          "success",
          `${params.accountType} Order Executed`,
          `${params.direction} ${params.size} ${params.symbol} at $${params.currentPrice}`
        );
        return true;
      } else {
        showToast("error", "Execution Blocked by Risk Engine", data.error);
        return false;
      }
    } catch {
      showToast("error", "Execution Failed", "Network error communicating with order engine.");
      return false;
    }
  };

  // Close Trade Handler
  const handleCloseTrade = async (tradeId: string, currentPrice: number) => {
    const activeAcct = accountTypeRef.current;
    try {
      const res = await authFetch("/api/trade/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId, exitPrice: currentPrice, accountType: activeAcct }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.balance) {
          setBalance(data.balance);
        }
        setTrades((prev) =>
          prev.map((t) =>
            t.id === tradeId
              ? {
                  ...t,
                  status: "CLOSED" as const,
                  exitPrice: currentPrice,
                  pnl: data.trade?.pnl ?? t.pnl,
                }
              : t
          )
        );
        fetchPositions(activeAcct);
        fetchBalanceAndUser(activeAcct);
        const pnl = data.trade?.pnl ?? 0;
        showToast(
          pnl >= 0 ? "success" : "warning",
          "Position Closed",
          `Realized PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} credited to ${activeAcct} Balance`
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-Predict & Execute Handler (1-Click Algorithmic Execution for Big Margin Profits)
  const handleAutoExecutePrediction = async (pred: PredictionResult) => {
    // Synchronize selected asset to prediction symbol to prevent cross-asset price mismatches
    const matchingAsset = assets.find((a) => a.symbol === pred.symbol) || selectedAsset;
    setSelectedAsset(matchingAsset);
    selectedAssetRef.current = matchingAsset;

    // Realistic, high-win alpha sizing calibrated for $10,000 capital (leaves 80%+ margin free)
    let size = 0.25;
    if (pred.assetClass === "FOREX") size = 0.5; // 0.5 lot = $50k notional, ~$1,000 margin
    else if (pred.symbol.includes("SOL")) size = 15.0; // 15 SOL = ~$2,400 notional, ~$120 margin
    else if (pred.symbol.includes("ETH")) size = 2.0;  // 2 ETH = ~$7,000 notional, ~$350 margin
    else size = 0.25; // 0.25 BTC = ~$16,000 notional, ~$800 margin

    const curPrice = matchingAsset.currentPrice;
    const isForex = pred.assetClass === "FOREX";
    const digits = matchingAsset.digits || (isForex ? (pred.symbol.includes("JPY") ? 3 : 5) : 2);

    // Dynamically calculate robust Big Margin Profit TP & SL distances relative to actual asset price
    const rawTpDist = Math.abs(pred.takeProfit - pred.entryPrice);
    const rawSlDist = Math.abs(pred.entryPrice - pred.stopLoss);
    const minTpDist = curPrice * (isForex ? 0.005 : 0.035);
    const minSlDist = curPrice * (isForex ? 0.0025 : 0.015);

    const tpDist = Math.max(rawTpDist, minTpDist);
    const slDist = Math.max(rawSlDist, minSlDist);

    const safeTP = Number(
      (pred.direction === "LONG" ? curPrice + tpDist : curPrice - tpDist).toFixed(digits)
    );
    const safeSL = Number(
      (pred.direction === "LONG" ? curPrice - slDist : curPrice + slDist).toFixed(digits)
    );

    const success = await handleExecuteTrade({
      accountType,
      symbol: matchingAsset.symbol,
      assetClass: matchingAsset.assetClass,
      direction: pred.direction,
      orderType: "MARKET",
      size,
      leverage: 20,
      currentPrice: curPrice,
      stopLoss: safeSL,
      takeProfit: safeTP,
      rationale: `[AUTO-PREDICT BIG MARGIN] ${pred.rationale}`,
    });

    if (success) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      showToast(
        "success",
        "⚡ Big Margin Order Placed!",
        `${pred.direction} ${size} ${matchingAsset.symbol} targeting Take Profit at $${safeTP}`
      );
    }
  };

  return (
    <>
      {view === "LANDING" ? (
          <LandingHero
            assets={assets}
            onOpenTerminal={handleOpenTerminal}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
      ) : (
        <main className="min-h-screen flex flex-col bg-[#050b14] pb-20 md:pb-6 transition-colors duration-200">
          {/* Top Financial Margin Bar */}
          <Navbar
            balance={balance}
            accountType={accountType}
            onSwitchAccount={handleSwitchAccount}
            onOpenDeposit={handleOpenDepositModal}
            onOpenLedger={() => setIsLedgerOpen(true)}
            onGoHome={() => setView("LANDING")}
            activeSymbol={selectedAsset.symbol}
            currency={currency}
            onToggleCurrency={() =>
              setCurrency((c) => (c === "KES" ? "USD" : "KES"))
            }
            onSelectCurrency={(c) => setCurrency(c)}
            usdKesRate={usdKesRate}
            activeSection={section}
            onSelectSection={(sec) => setSection(sec)}
            user={user}
            onLogout={handleLogout}
          />

          {section === "HOME" && (
            <div className="flex-1 p-2 sm:p-3 lg:p-4 max-w-[1920px] w-full mx-auto">
              <HomeDashboard
                user={user}
                balance={balance}
                profile={profile}
                referrals={referrals}
                trades={trades}
                assets={assets}
                accountType={accountType}
                currency={currency}
                usdKesRate={usdKesRate}
                onNavigateToTrade={(targetType, asset) => {
                  if (targetType) handleSwitchAccount(targetType);
                  if (asset) {
                    setSelectedAsset(asset);
                    selectedAssetRef.current = asset;
                  }
                  setSection("TRADE");
                }}
                onNavigateToReferrals={() => setSection("REFERRAL")}
                onNavigateToMike={() => setSection("MIKE_AI")}
                onOpenDeposit={(tab) => handleOpenDepositModal(tab || "DEPOSIT")}
                onCloseTrade={handleCloseTrade}
                onRefreshBalance={() => fetchBalanceAndUser("REAL")}
                onOpenAuth={() => setIsAuthOpen(true)}
              />
            </div>
          )}

          {section === "TRADE" && (
            <>
              {/* Asset Selector */}
              <AssetSelector
                assets={assets}
                selectedAsset={selectedAsset}
                onSelectAsset={(asset) => setSelectedAsset(asset)}
              />

              {/* Mobile Sub-Tab Navigation (hidden on desktop) */}
              <div className="flex items-center gap-0 border-b border-[#142848] bg-[#060c18] md:hidden overflow-x-auto scrollbar-none">
                {([
                  { id: "chart", label: "📊 Chart" },
                  { id: "order", label: "⚡ Order" },
                  { id: "signals", label: "🎯 Signals" },
                  { id: "positions", label: "📋 Positions" },
                ] as const).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setMobileTradeTab(id)}
                    className={`flex-1 min-w-max px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
                      mobileTradeTab === id
                        ? "border-[#e2ff3b] text-[#e2ff3b] bg-[#e2ff3b]/10"
                        : "border-transparent text-[#7c93b2] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Main Trading Workspace */}
              <div className="flex-1 p-2 sm:p-3 lg:p-4 space-y-3 max-w-[1920px] w-full mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Chart & Prediction — hidden on mobile if not on chart/signals tab */}
                  <div className={`lg:col-span-8 xl:col-span-9 flex flex-col gap-4 ${
                    mobileTradeTab === "chart" || mobileTradeTab === "signals" ? "block" : "hidden md:flex"
                  }`}>
                    {(() => {
                      const activeSymbolTrade = trades.find(
                        (t) =>
                          t.status === "OPEN" &&
                          t.symbol === selectedAsset.symbol &&
                          (t.accountType || "REAL") === accountType
                      );
                      const chartStopLoss = activeSymbolTrade?.stopLoss ?? prefilledPrediction?.stopLoss;
                      const chartTakeProfit = activeSymbolTrade?.takeProfit ?? prefilledPrediction?.takeProfit;
                      const chartEntryPrice = activeSymbolTrade?.entryPrice ?? selectedAsset.currentPrice;

                      return (
                        <div className={mobileTradeTab === "signals" ? "hidden md:block" : ""}>
                          <TradingViewChart
asset={selectedAsset}
              candles={candles}
              stopLoss={chartStopLoss}
              takeProfit={chartTakeProfit}
              entryPrice={chartEntryPrice}
              timeframe={timeframe}
              onTimeframeChange={(tf) => setTimeframe(tf)}
              dataNotice={
                !candleResolution.honoured
                  ? `The daily European Central Bank reference rate is the only forex history available, so this is a ${candleResolution.interval} chart regardless of the selected interval. Add TWELVE_DATA_API_KEY for intraday forex.`
                  : marketDelayed
                    ? selectedAsset.assetClass === "FOREX"
                      ? "Forex is on the daily European Central Bank reference rate. Add TWELVE_DATA_API_KEY for live intraday forex."
                      : "Live feed unavailable. Showing the last known quote."
                    : null
              }
            />
                        </div>
                      );
                    })()}

                    <PredictionPanel
                      prediction={prediction}
                      loading={predictionLoading}
                      onRefresh={() => fetchPrediction(false)}
                      onApplyPrediction={(pred) => {
                        const match = assets.find((a) => a.symbol === pred.symbol);
                        if (match) {
                          setSelectedAsset(match);
                          selectedAssetRef.current = match;
                        }
                        setPrefilledPrediction(pred);
                        setMobileTradeTab("order");
                      }}
                      onAutoExecute={handleAutoExecutePrediction}
                      asset={selectedAsset}
                      accountType={accountType}
                    />

                    <AnalysisPanel
                      report={analysis}
                      loading={analysisLoading}
                      onRefresh={() => fetchAnalysis(false)}
                      onApplySetup={(pred) => {
                        const match = assets.find((a) => a.symbol === pred.symbol);
                        if (match) {
                          setSelectedAsset(match);
                          selectedAssetRef.current = match;
                        }
                        setPrefilledPrediction(pred);
                        setMobileTradeTab("order");
                      }}
                    />
                  </div>

                  {/* Order Execution Ticket with Risk Enforcement */}
                  <div className={`lg:col-span-4 xl:col-span-3 ${
                    mobileTradeTab === "order" ? "block" : "hidden md:block"
                  }`}>
                    <TradeTicket
                      asset={selectedAsset}
                      balance={balance}
                      accountType={accountType}
                      onExecuteTrade={handleExecuteTrade}
                      prefilledPrediction={prefilledPrediction}
                    />
                  </div>
                </div>

                {/* Positions Table — hidden on mobile when not on positions tab */}
                <div className={mobileTradeTab === "positions" ? "block" : "hidden md:block"}>
                  <PositionsTable
                    trades={trades}
                    accountType={accountType}
                    onCloseTrade={handleCloseTrade}
                  />
                </div>
              </div>
            </>
          )}


          {section === "REFERRAL" && (
            <div className="flex-1 p-2 sm:p-3 lg:p-4 max-w-[1920px] w-full mx-auto">
              <ReferralPanel
                stats={referrals}
                currency={currency}
                onSubmitted={() => {
                  fetchReferrals();
                  fetchProfile();
                  fetchBalanceAndUser("REAL");
                  showToast(
                    "success",
                    "Referral Reward Credited",
                    "The bonus was added to your REAL account."
                  );
                }}
              />
            </div>
          )}

          {section === "PROFILE" && (
            <div className="flex-1 p-2 sm:p-3 lg:p-4 max-w-[1920px] w-full mx-auto">
              <ProfilePanel
                profile={profile}
                provider={profile?.provider}
                permissions={profile?.permissions}
                authenticated={profile?.authenticated ?? false}
                currency={currency}
                trades={trades}
                accountType={accountType}
                onOpenLedger={() => setIsLedgerOpen(true)}
                onOpenDeposit={handleOpenDepositModal}
                onToggleCurrency={() =>
                  setCurrency((c) => (c === "KES" ? "USD" : "KES"))
                }
                onLogout={handleLogout}
                onAccountDeleted={handleAccountDeleted}
              />
            </div>
          )}

          {section === "MIKE_AI" && (
            <div className="flex-1 p-2 sm:p-3 lg:p-4 max-w-[1920px] w-full mx-auto">
              <MikeTradesChat />
            </div>
          )}

          {/* Floating Mike Trades Chat Button (visible when not on MIKE_AI screen) */}
          <FloatingMikeButton
            onClick={() => setSection("MIKE_AI")}
            visible={section !== "MIKE_AI"}
          />

          {/* Android Bottom Navigation (5 sections: HOME | TRADE | REFERRAL | PROFILE | MIKE AI) */}
          <BottomNav
            active={section}
            onSelect={(next) => {
              setSection(next);
              if (view !== "TERMINAL") setView("TERMINAL");
            }}
              tradesBadge={trades.filter(
                (t) => t.status === "OPEN" && (t.accountType || "REAL") === accountType
              ).length}
              referralBadge={referrals?.totalReferrals ?? 0}
            />

          {/* Interactive Modals */}
          <DepositModal
            isOpen={isDepositOpen}
            initialTab={depositModalTab}
            onClose={() => setIsDepositOpen(false)}
            user={user}
            onDepositSuccess={(newBal) => {
              setBalance(newBal);
              setProfile((prev) => (prev ? { ...prev, real: newBal } : prev));
              fetchBalanceAndUser(accountType);
              fetchProfile();
              showToast("success", "Deposit Verified", "Capital credited to available balance.");
            }}
          />

          <LedgerModal
            isOpen={isLedgerOpen}
            onClose={() => setIsLedgerOpen(false)}
            accountType={accountType}
          />
        </main>
      )}

      {/* Global AuthModal rendered at root level: accessible from LandingHero, HomeDashboard, and any CTA click */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(chosenType) => {
          setAccountType(chosenType);
          accountTypeRef.current = chosenType;
          setSection("HOME");
          setView("TERMINAL");
          fetchBalanceAndUser(chosenType);
          fetchProfile();
        }}
      />
    </>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <SessionProvider>
        <TradingPlatformContent />
      </SessionProvider>
    </ToastProvider>
  );
}
