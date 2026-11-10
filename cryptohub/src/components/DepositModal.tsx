"use client";

import React, { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import { User, Balance } from "@/types";
import { authFetch } from "@/lib/auth/session";
import {
  X,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Zap,
  ArrowUpRight,
  History,
  Lock,
} from "lucide-react";
import { generateQRCodeSVG } from "@/lib/qr";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  initialTab?: "DEPOSIT" | "WITHDRAW" | "HISTORY";
  onDepositSuccess: (newBalance: Balance) => void;
}

const VAULT_ADDRESS = "TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  user,
  initialTab = "DEPOSIT",
  onDepositSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"DEPOSIT" | "WITHDRAW" | "HISTORY">(initialTab);
  const [depositAmount, setDepositAmount] = useState<string>("300");
  const [txHashInput, setTxHashInput] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [paylorIntent, setPaylorIntent] = useState<any | null>(null);

  // Withdrawal States (Authoritative minimum $100.00 USDT)
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("100");
  const [withdrawalsHistory, setWithdrawalsHistory] = useState<any[]>([]);
  const [depositsHistory, setDepositsHistory] = useState<any[]>([]);

  // Synchronize initialTab when modal opens
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Escape key listener to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const fetchHistoryAndIntent = useCallback(async () => {
    try {
      const [wRes, dRes, pRes] = await Promise.allSettled([
        authFetch("/api/ledger/withdraw"),
        authFetch("/api/ledger/deposit/trc20"),
        authFetch("/api/payments/paylor/intent"),
      ]);

      if (wRes.status === "fulfilled" && wRes.value.ok) {
        const wData = await wRes.value.json();
        if (wData.success) setWithdrawalsHistory(wData.withdrawals || []);
      }
      if (dRes.status === "fulfilled" && dRes.value.ok) {
        const dData = await dRes.value.json();
        if (dData.success) setDepositsHistory(dData.deposits || []);
      }
      if (pRes.status === "fulfilled" && pRes.value.ok) {
        const pData = await pRes.value.json();
        if (pData.success) {
          setPaylorIntent({
            vaultAddress: pData.walletAddress,
            contractAddress: pData.contractAddress,
            network: pData.network,
            channel: pData.channel,
          });
        }
      }
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorNotice(null);
      setSuccessNotice(null);
      fetchHistoryAndIntent();
    }
  }, [isOpen, fetchHistoryAndIntent]);

  if (!isOpen) return null;

  const vaultAddress = paylorIntent?.vaultAddress || user?.usdtAddress || VAULT_ADDRESS;

  const handleCopy = () => {
    navigator.clipboard.writeText(vaultAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitTRC20Hash = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const cleanHash = txHashInput.trim();
    const numAmt = parseFloat(depositAmount);

    if (!cleanHash || cleanHash.length < 10) {
      setLoading(false);
      setErrorNotice("Please enter a valid TRON (TRC20) transaction hash.");
      return;
    }

    if (!Number.isFinite(numAmt) || numAmt <= 0) {
      setLoading(false);
      setErrorNotice("Please enter a valid positive USDT deposit amount.");
      return;
    }

    try {
      const res = await authFetch("/api/ledger/deposit/trc20", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: cleanHash,
          amount: numAmt,
          contractAddress: USDT_CONTRACT,
          toAddress: vaultAddress,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorNotice(data.error || "Failed to register TRC20 deposit hash.");
      } else {
        setSuccessNotice(data.message);
        setTxHashInput("");
        fetchHistoryAndIntent();
        const balRes = await authFetch("/api/ledger/balance?accountType=REAL");
        if (balRes.ok) {
          const balData = await balRes.json();
          if (balData.balance) onDepositSuccess(balData.balance);
        }
      }
    } catch (err: any) {
      setErrorNotice("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const numWithdraw = parseFloat(withdrawAmount);
    if (!Number.isFinite(numWithdraw) || numWithdraw < 100) {
      setLoading(false);
      setErrorNotice("Minimum withdrawal amount is $100.00 USDT (server-enforced).");
      return;
    }

    try {
      const res = await authFetch("/api/ledger/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationAddress: withdrawAddress.trim(),
          amount: numWithdraw,
        }),
      });

      const data = await res.json();
      if (data.success) {
        try {
          confetti({
            particleCount: 120,
            spread: 85,
            origin: { y: 0.6 },
            colors: ["#38bdf8", "#e2ff3b", "#10b981", "#ffffff"],
          });
        } catch {
          /* ignore */
        }
        setSuccessNotice(data.message);
        setWithdrawAddress("");
        fetchHistoryAndIntent();
        const balRes = await authFetch("/api/ledger/balance?accountType=REAL");
        if (balRes.ok) {
          const balData = await balRes.json();
          if (balData.balance) {
            onDepositSuccess(balData.balance);
          }
        }
      } else {
        setErrorNotice(data.error || "Withdrawal request failed.");
      }
    } catch (err: any) {
      setErrorNotice("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const qrSvgString = generateQRCodeSVG(vaultAddress);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="treasury-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-[#081324] border border-[#163660] rounded-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#142848] bg-[#050c18] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#e2ff3b]/15 border border-[#e2ff3b]/40 text-[#e2ff3b] flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 id="treasury-modal-title" className="font-extrabold text-base text-white tracking-wide">
                Live TRC20 USDT Treasury
              </h3>
              <p className="text-xs text-[#7c93b2]">
                Paylor Channel PAYL-EFSJUF · 19 Block Confirmations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#7c93b2] hover:text-white p-1.5 rounded-lg hover:bg-[#0a182e] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: DEPOSIT vs WITHDRAW vs HISTORY */}
        <div className="flex border-b border-[#142848] bg-[#050c18] p-1">
          <button
            onClick={() => setActiveTab("DEPOSIT")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "DEPOSIT"
                ? "bg-[#0a203e] text-[#e2ff3b] border border-[#e2ff3b]/40 shadow-xs"
                : "text-[#7c93b2] hover:text-white"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Deposit USDT
          </button>
          <button
            onClick={() => setActiveTab("WITHDRAW")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "WITHDRAW"
                ? "bg-[#0a203e] text-[#38bdf8] border border-[#38bdf8]/40 shadow-xs"
                : "text-[#7c93b2] hover:text-white"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Withdraw (Min $100)
          </button>
          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "HISTORY"
                ? "bg-slate-800 text-slate-200 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            History ({depositsHistory.length + withdrawalsHistory.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {errorNotice && (
            <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorNotice}</span>
            </div>
          )}

          {successNotice && (
            <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* TAB 1: DEPOSIT (Strictly TRC20 USDT) */}
          {activeTab === "DEPOSIT" && (
            <form onSubmit={handleSubmitTRC20Hash} className="space-y-4">
              {/* Tier Presets */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Select Deposit Tier (Unlocks Daily Auto-Trade Rewards)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { amt: "300", label: "$300 (L3)" },
                    { amt: "500", label: "$500 (L2)" },
                    { amt: "600", label: "$600 (L1)" },
                    { amt: "1000", label: "$1,000" },
                  ].map((t) => (
                    <button
                      key={t.amt}
                      type="button"
                      onClick={() => setDepositAmount(t.amt)}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                        depositAmount === t.amt
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                          : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scannable Real Dynamic SVG QR Code */}
              <div className="flex flex-col items-center bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <div
                  className="h-36 w-36 bg-white p-2.5 rounded-xl shadow-lg flex items-center justify-center mb-3"
                  dangerouslySetInnerHTML={{ __html: qrSvgString }}
                />
                <span className="text-[11px] text-emerald-400 font-bold mb-1">
                  Send ONLY USDT on TRON Network (TRC20)
                </span>
                <span className="text-[10px] text-slate-500 font-mono mb-2">
                  Contract: {USDT_CONTRACT}
                </span>
                <div className="flex items-center gap-2 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-cyan-400">
                  <span className="truncate flex-1">{vaultAddress}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 hover:text-white text-slate-400 shrink-0"
                    title="Copy Vault Address"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Amount & On-Chain TxHash Submission */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Amount Sent (USDT)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    TRON Transaction Hash (TxID)
                  </label>
                  <input
                    type="text"
                    required
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    placeholder="Paste 64-char TRON txHash after transfer..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#e2ff3b] hover:bg-[#d5f32a] text-[#050b14] font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-[#e2ff3b]/20"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading ? "Registering On-Chain Hash..." : "Submit TRC20 Deposit Hash for Verification"}
              </button>
            </form>
          )}

          {/* TAB 2: WITHDRAW */}
          {activeTab === "WITHDRAW" && (
            <form onSubmit={handleRequestWithdrawal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Destination TRC20 (TRON) USDT Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  TRC20 addresses start with &quot;T&quot; and must be exactly 34 characters long.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Withdrawal Amount (Minimum $100.00 USDT)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    min="100"
                    step="0.01"
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Fee Breakdown & Working Capital Governance */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Minimum Withdrawal:</span>
                  <span className="font-mono text-slate-200">100.00 USDT</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Network Gas Fee (TRON TRC20):</span>
                  <span className="font-mono text-slate-200">1.00 USDT</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Gross Amount Deducted:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {(parseFloat(withdrawAmount) || 0).toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Net Sent to Destination Wallet:</span>
                  <span className="font-mono font-bold text-[#e2ff3b]">
                    {Math.max(0, (parseFloat(withdrawAmount) || 0) - 1.0).toFixed(2)} USDT
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-start gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#e2ff3b] shrink-0 mt-0.5" />
                  <span>
                    Withdrawals are drawn from your generated earnings (Auto-Trade yields, Referral bonuses, Trade profits). Working capital deposits remain active to generate daily yields.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-[#0ea5e9]/25"
              >
                <ArrowUpRight className="w-4 h-4" />
                {loading ? "Submitting Request..." : "Request TRC20 Withdrawal"}
              </button>
            </form>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === "HISTORY" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  TRC20 Deposits ({depositsHistory.length})
                </h4>
                {depositsHistory.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                    No TRC20 deposit records yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {depositsHistory.map((d: any) => (
                      <div
                        key={d.id}
                        className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-emerald-400">
                            +{Number(d.amount).toFixed(2)} USDT (TRC20)
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              d.state === "CREDITED"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {d.state} ({d.confirmations}/{d.requiredConfirmations})
                          </span>
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono truncate">
                          TxHash: {d.txHash}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Withdrawal Requests ({withdrawalsHistory.length})
                </h4>
                {withdrawalsHistory.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                    No withdrawal requests found for this account.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {withdrawalsHistory.map((w: any) => (
                      <div
                        key={w.id}
                        className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-white">
                            {w.amount.toFixed(2)} {w.asset} ({w.network})
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              w.state === "COMPLETED"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : w.state === "REJECTED"
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {w.state}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          To: {w.destinationAddress}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>{new Date(w.requestedAt).toLocaleString()}</span>
                          <span>Fee: {w.fee.toFixed(2)} USDT</span>
                        </div>
                        {w.txHash && (
                          <div className="text-[10px] text-cyan-400 font-mono truncate">
                            TxHash: {w.txHash}
                          </div>
                        )}
                        {w.rejectedReason && (
                          <div className="text-[10px] text-rose-400">
                            Reason: {w.rejectedReason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
