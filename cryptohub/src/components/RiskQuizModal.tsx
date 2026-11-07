"use client";

import React, { useState } from "react";
import { X, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { authFetch } from "@/lib/auth/session";

interface RiskQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RiskQuizModal: React.FC<RiskQuizModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [q1, setQ1] = useState<string>("");
  const [q2, setQ2] = useState<string>("");
  const [q3, setQ3] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (q1 !== "2" || q2 !== "sl" || q3 !== "prob") {
      setError("Please review your answers. All quantitative risk principles must be understood before real capital trading.");
      return;
    }

    setSubmitting(true);
    try {
      // The server holds the correct answers, so this is a real check: it
      // refuses to record the certification if the answers are wrong.
      const res = await authFetch("/api/auth/risk-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q1, q2, q3 }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Could not record your certification. Please try again.");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error. Your certification was not recorded.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-quiz-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-[#121827] border border-amber-500/40 rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-950/70 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 id="risk-quiz-title" className="font-extrabold text-base text-white">
                Real Account Risk Certification
              </h3>
              <p className="text-xs text-slate-400">
                Institutional Risk Acknowledgement (Mandatory for Live Funds)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-xl flex items-start gap-2.5 text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <p className="text-[11px] leading-relaxed">
              Real accounts trade with live capital under strict <strong>Quantitative Risk Governance</strong>.
              Confirm your understanding of our protective risk rules to activate live trading.
            </p>
          </div>

          {/* Question 1 */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-200">
              1. Under the Risk Model, what is the maximum permitted balance risk per single trade?
            </label>
            <div className="space-y-1">
              {[
                { val: "2", label: "Strictly 1% to 2% of account balance" },
                { val: "10", label: "10% to 20% of account balance" },
                { val: "50", label: "Full leverage all-in" },
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    q1 === opt.val
                      ? "bg-amber-500/15 border-amber-500 text-white font-semibold"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="q1"
                    value={opt.val}
                    checked={q1 === opt.val}
                    onChange={(e) => setQ1(e.target.value)}
                    className="accent-amber-400"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 2 */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-200">
              2. Why is Stop Loss (SL) mandatory on every Real trade?
            </label>
            <div className="space-y-1">
              {[
                { val: "sl", label: "To strictly contain downside loss and protect against total liquidation" },
                { val: "none", label: "It is optional; markets always recover" },
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    q2 === opt.val
                      ? "bg-amber-500/15 border-amber-500 text-white font-semibold"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="q2"
                    value={opt.val}
                    checked={q2 === opt.val}
                    onChange={(e) => setQ2(e.target.value)}
                    className="accent-amber-400"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 3 */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-200">
              3. Does a disciplined risk strategy mean individual trade outcomes are guaranteed?
            </label>
            <div className="space-y-1">
              {[
                { val: "prob", label: "No. Individual trades are probabilistic; long-term edge requires strict discipline." },
                { val: "guar", label: "Yes, every trade is guaranteed to win" },
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    q3 === opt.val
                      ? "bg-amber-500/15 border-amber-500 text-white font-semibold"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="q3"
                    value={opt.val}
                    checked={q3 === opt.val}
                    onChange={(e) => setQ3(e.target.value)}
                    className="accent-amber-400"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting ? "Verifying..." : "Acknowledge Risk & Unlock Real Account"}
          </button>
        </form>
      </div>
    </div>
  );
};
