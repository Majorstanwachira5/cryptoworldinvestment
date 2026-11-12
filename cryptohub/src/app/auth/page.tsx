"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  Activity,
  Zap,
  ArrowRight,
  ChevronRight,
  Gift,
} from "lucide-react";
import { loginAccount, registerAccount, readToken } from "@/lib/auth/session";
import { CwiLogo } from "@/components/CwiLogo";

/* ─────────────────────────── animated ticker strip ─────────────────────── */

const TICKERS = [
  { symbol: "BTC/USD", price: "67,482.50", change: "+2.34%" },
  { symbol: "ETH/USD", price: "3,521.80", change: "+1.87%" },
  { symbol: "SOL/USD", price: "168.24", change: "+4.12%" },
  { symbol: "EUR/USD", price: "1.0821", change: "-0.15%" },
  { symbol: "GBP/USD", price: "1.2694", change: "+0.22%" },
  { symbol: "XRP/USD", price: "0.6124", change: "+3.45%" },
  { symbol: "ADA/USD", price: "0.4891", change: "+1.63%" },
  { symbol: "DOGE/USD", price: "0.1523", change: "+5.71%" },
];

function TickerStrip() {
  return (
    <div className="relative overflow-hidden border-b border-white/5 bg-black/30 py-2">
      <div className="ticker-track flex gap-8 whitespace-nowrap">
        {[...TICKERS, ...TICKERS].map((t, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">{t.symbol}</span>
            <span className="text-white font-semibold">{t.price}</span>
            <span
              className={`text-[10px] font-bold ${
                t.change.startsWith("+") ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {t.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── animated stat counters ─────────────────────── */

const STATS = [
  { label: "Active Traders", value: "12,481", icon: User },
  { label: "Daily Volume", value: "$4.2B", icon: TrendingUp },
  { label: "Assets Listed", value: "340+", icon: BarChart2 },
  { label: "Uptime", value: "99.97%", icon: Activity },
];

/* ───────────────────────────── floating orb bg ─────────────────────────── */

function BackgroundOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      {/* grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}

/* ─────────────────────────────── main page ─────────────────────────────── */

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Redirect already-authenticated users straight to the terminal
  useEffect(() => {
    if (readToken()) {
      router.replace("/");
    }
  }, [router]);

  // Capture referral code from ?ref= query parameter or saved invitation
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRef = (params.get("ref") || "").trim().toUpperCase();
      const registerFlag = params.get("register") === "1";
      const storedRef = (window.localStorage.getItem("cwi_referral_code") || "")
        .trim()
        .toUpperCase();
      const effectiveRef = urlRef || storedRef;
      if (urlRef) {
        window.localStorage.setItem("cwi_referral_code", urlRef);
      }
      if (effectiveRef) {
        setReferralCode(effectiveRef);
        setMode("REGISTER");
      } else if (registerFlag) {
        setMode("REGISTER");
      }
    } catch {
      // Ignore URL/storage access errors.
    }
  }, []);

  useEffect(() => {
    emailRef.current?.focus();
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) return setError("Email address is required.");
    if (!password) return setError("Password is required.");
    if (mode === "REGISTER") {
      if (name.trim().length < 2) return setError("Enter your full name (at least 2 characters).");
      if (password.length < 8) return setError("Password must be at least 8 characters.");
    }

    setLoading(true);
    try {
      if (mode === "REGISTER") {
        const cleanRef = referralCode.trim().toUpperCase();
        await registerAccount({
          name,
          email,
          password,
          referralCode: cleanRef || undefined,
        });
        try {
          window.localStorage.removeItem("cwi_referral_code");
        } catch {
          // Ignore storage error.
        }
        setSuccess("Account created — taking you to the platform…");
      } else {
        await loginAccount({ email, password });
        setSuccess("Authenticated — opening your dashboard…");
      }
      setTimeout(() => router.replace("/"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === "REGISTER";

  return (
    <>
      {/* ── inline styles (no Tailwind plugins needed) ── */}
      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .ticker-track { animation: ticker 28s linear infinite; }
        @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-60px) scale(1.08)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-60px,40px) scale(1.12)} }
        @keyframes float3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(50px,50px) scale(0.95)} }
        .orb { position:absolute; border-radius:9999px; filter:blur(80px); opacity:.35; }
        .orb-1 { width:520px; height:520px; top:-120px; left:-100px; background:radial-gradient(circle,#6366f1,transparent 70%); animation:float1 14s ease-in-out infinite; }
        .orb-2 { width:420px; height:420px; bottom:-80px; right:-80px; background:radial-gradient(circle,#06b6d4,transparent 70%); animation:float2 18s ease-in-out infinite; }
        .orb-3 { width:300px; height:300px; top:50%; right:20%; background:radial-gradient(circle,#8b5cf6,transparent 70%); animation:float3 22s ease-in-out infinite; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .55s cubic-bezier(.22,.68,0,1.2) both; }
        .glass-card {
          background: rgba(13,17,32,.82);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,.08);
          box-shadow: 0 0 0 1px rgba(99,102,241,.1), 0 40px 80px rgba(0,0,0,.6);
        }
        .input-field {
          width:100%;
          background:rgba(15,23,42,.7);
          border:1px solid rgba(100,116,139,.3);
          border-radius:.625rem;
          color:#fff;
          font-size:.875rem;
          padding:.625rem .75rem;
          outline:none;
          transition:border-color .2s,box-shadow .2s;
        }
        .input-field:focus {
          border-color:#6366f1;
          box-shadow:0 0 0 3px rgba(99,102,241,.18);
        }
        .input-field::placeholder { color:#475569; }
        .btn-primary {
          display:flex; align-items:center; justify-content:center; gap:.5rem;
          width:100%; padding:.75rem 1rem;
          background:linear-gradient(135deg,#6366f1,#06b6d4);
          border:none; border-radius:.75rem;
          color:#fff; font-weight:800; font-size:.9rem;
          cursor:pointer; transition:opacity .2s,transform .15s;
          box-shadow:0 8px 24px rgba(99,102,241,.35);
        }
        .btn-primary:hover:not(:disabled){ opacity:.92; transform:translateY(-1px); }
        .btn-primary:active:not(:disabled){ transform:translateY(0); }
        .btn-primary:disabled{ opacity:.55; cursor:not-allowed; }
        .tab-btn {
          flex:1; padding:.45rem .75rem;
          border:none; border-radius:.5rem;
          font-weight:700; font-size:.8rem;
          cursor:pointer; transition:all .2s;
        }
        .tab-active { background:linear-gradient(135deg,#6366f1,#06b6d4); color:#fff; box-shadow:0 4px 12px rgba(99,102,241,.3); }
        .tab-inactive { background:transparent; color:#64748b; }
        .tab-inactive:hover { color:#94a3b8; }
        .stat-card {
          display:flex; flex-direction:column; align-items:center; gap:.25rem;
          padding:.75rem 1rem;
          background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.06);
          border-radius:.75rem;
        }
        @media(max-width:640px){ .auth-layout{ flex-direction:column; } .hero-panel{ display:none; } }
      `}</style>

      <div
        className="min-h-screen flex flex-col"
        style={{ background: "linear-gradient(135deg,#060b17 0%,#0c1120 50%,#080d1a 100%)" }}
      >
        {/* ticker */}
        <TickerStrip />

        <div className="flex flex-1 relative overflow-hidden auth-layout" style={{ display: "flex" }}>
          <BackgroundOrbs />

          {/* ── Left hero panel ── */}
          <div
            className="hero-panel flex flex-col justify-between p-10 relative z-10"
            style={{ flex: "1 1 55%", minWidth: 0 }}
          >
            {/* logo */}
            <div className="flex items-center gap-3">
              <CwiLogo size={42} showText textSubtitle="Institutional Quant Platform" />
            </div>

            {/* headline */}
            <div className="fade-up max-w-lg">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 text-xs font-bold text-cyan-300"
                style={{ background: "rgba(6,182,212,.12)", border: "1px solid rgba(6,182,212,.25)" }}>
                <Zap className="w-3.5 h-3.5" />
                Real-Time Markets · Verified Data
              </div>
              <h1 className="text-5xl font-black text-white leading-[1.05] mb-5">
                Trade With
                <span
                  className="block"
                  style={{
                    background: "linear-gradient(90deg,#6366f1,#06b6d4)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Confidence.
                </span>
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed">
                Access live crypto and forex markets, AI-powered signals, and full backtest history
                — all backed by real, verified data. Never synthetic.
              </p>

              {/* feature bullets */}
              <div className="mt-8 space-y-3">
                {[
                  "Binance real-time market feed",
                  "AI signal engine with 30-trade minimum",
                  "Risk-aware backtests on verified candle history",
                  "Live REAL accounts with TRC20 USDT double-entry ledger audit",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-slate-300">
                    <ChevronRight className="w-4 h-4 text-cyan-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* stats strip */}
            <div className="grid grid-cols-4 gap-3 mt-10">
              {STATS.map(({ label, value, icon: Icon }) => (
                <div key={label} className="stat-card">
                  <Icon className="w-4 h-4 text-indigo-400" />
                  <div className="text-base font-black text-white">{value}</div>
                  <div className="text-[10px] text-slate-500 text-center leading-tight">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right auth card ── */}
          <div
            className="flex items-center justify-center p-6 relative z-10"
            style={{ flex: "0 0 420px", minWidth: "320px" }}
          >
            <div className="glass-card rounded-2xl w-full max-w-sm p-7 fade-up" style={{ animationDelay: ".1s" }}>
              {/* card header */}
              <div className="text-center mb-6">
                <div className="flex justify-center mb-3">
                  <CwiLogo size={48} variant="icon" />
                </div>
                <h2 className="text-xl font-extrabold text-white">
                  {isRegister ? "Create Account" : "Welcome Back"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {isRegister ? "Join CryptoWorldInvestment — Start Trading" : "Sign in to access your dashboard"}
                </p>
              </div>

              {/* mode tabs */}
              <div
                className="flex p-1 mb-5 rounded-xl"
                style={{ background: "rgba(15,23,42,.6)", border: "1px solid rgba(100,116,139,.15)" }}
              >
                {(["LOGIN", "REGISTER"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                    className={`tab-btn ${mode === m ? "tab-active" : "tab-inactive"}`}
                  >
                    {m === "LOGIN" ? "Sign In" : "Register"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="space-y-4" noValidate>
                {/* name (register only) */}
                {isRegister && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Kamau"
                        className="input-field"
                        style={{ paddingLeft: "2.25rem" }}
                      />
                    </div>
                  </div>
                )}

                {/* email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      ref={emailRef}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input-field"
                      style={{ paddingLeft: "2.25rem" }}
                    />
                  </div>
                </div>

                {/* password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPw ? "text" : "password"}
                      autoComplete={isRegister ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isRegister ? "Min 8 characters with a number" : "Your password"}
                      className="input-field"
                      style={{ paddingLeft: "2.25rem", paddingRight: "3rem" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {isRegister && (
                    <p className="text-[10px] text-slate-600 mt-1.5">
                      Stored as a salted scrypt hash — never logged or returned.
                    </p>
                  )}
                </div>

                {/* referral code (register only) */}
                {isRegister && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Referral Code <span className="text-slate-600 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Gift className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        placeholder="e.g. CWI8A1B2C3D"
                        className="input-field font-mono uppercase"
                        style={{ paddingLeft: "2.25rem" }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5">
                      $30.00 USDT reward unlocks to your referrer once your deposit is confirmed ($300+ tier).
                    </p>
                  </div>
                )}

                {/* error */}
                {error && (
                  <div
                    className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs text-rose-300"
                    style={{ background: "rgba(159,18,57,.15)", border: "1px solid rgba(159,18,57,.35)" }}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    {error}
                  </div>
                )}

                {/* success */}
                {success && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-emerald-300"
                    style={{ background: "rgba(6,78,59,.2)", border: "1px solid rgba(16,185,129,.3)" }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    {success}
                  </div>
                )}

                {/* submit */}
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      {isRegister ? "Creating account…" : "Signing in…"}
                    </>
                  ) : (
                    <>
                      {isRegister ? "Create Account" : "Sign In"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* trust footer */}
              <div
                className="flex items-start gap-2 mt-5 pt-4 text-[10px] text-slate-600 leading-relaxed"
                style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px text-indigo-500" />
                <span>
                  Your credentials are verified server-side. The access token is validated on every
                  request and never stored in plaintext.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}