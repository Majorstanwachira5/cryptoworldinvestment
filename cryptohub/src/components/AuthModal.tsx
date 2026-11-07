"use client";

import React, { useEffect, useState } from "react";
import { X, Lock, Mail, User, ShieldCheck, AlertTriangle } from "lucide-react";
import { useToast } from "./Toast";
import { useSession } from "./SessionProvider";
import { AccountType } from "@/types";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (accountType: AccountType) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login, register, clearPendingAccount } = useSession();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPassword("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submit = async () => {
    setError(null);

    if (!email.trim()) return setError("Enter your email address.");
    if (!password) return setError("Enter your password.");
    if (mode === "REGISTER" && password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }
    if (mode === "REGISTER" && name.trim().length < 2) {
      return setError("Enter your full name.");
    }

    setLoading(true);
    try {
      const user =
        mode === "REGISTER"
          ? await register({ name, email, password })
          : await login({ email, password });

      showToast(
        "success",
        mode === "REGISTER" ? "Account created" : "Signed in",
        `Welcome, ${user.name}. Opening your REAL live trading account.`
      );

      clearPendingAccount();
      onLoginSuccess("REAL");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === "REGISTER";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-[#111726] border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0d121e] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
              CH
            </div>
            <div>
              <h3 id="auth-modal-title" className="font-extrabold text-base text-white">
                {isRegister ? "Create Live Account" : "Sign In"}
              </h3>
              <p className="text-xs text-slate-400">
                {isRegister
                  ? "Register to access your REAL live trading account"
                  : "Authenticate to access your REAL live trading terminal"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto">
          {/* Mode switch */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {(["LOGIN", "REGISTER"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 px-3 py-1.5 rounded-md font-bold transition-all ${
                  mode === m ? "bg-cyan-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                {m === "LOGIN" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {isRegister && (
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Kamau"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-slate-400 block mb-1 font-medium">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-medium">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder={isRegister ? "At least 6 characters" : "Your password"}
                className="w-full pl-9 pr-16 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 px-2"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {isRegister && (
              <p className="text-[10px] text-slate-500 mt-1">
                Stored as a salted scrypt hash. It is never logged or returned.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-800 rounded-lg px-3 py-2 text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Submit Button — Strictly REAL Live Account */}
          <div className="pt-1 space-y-2">
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition-all text-center disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {loading
                  ? isRegister
                    ? "Creating your REAL account…"
                    : "Verifying credentials…"
                  : isRegister
                  ? "Register & Open REAL Account"
                  : "Sign In to REAL Account"}
              </span>
            </button>
          </div>

          <div className="flex items-start gap-2 text-[10px] text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px text-cyan-500" />
            <span>
              Your password is verified on the server and never leaves it. All accounts operate
              exclusively on live REAL capital backed by the TRC20 USDT double-entry ledger.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
