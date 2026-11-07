"use client";

import React, { useState, useEffect } from "react";
import { User, Balance, Trade, MarketAsset } from "@/types";
import {
  X,
  ShieldAlert,
  BarChart3,
  Users,
  Radio,
  Send,
  DollarSign,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: MarketAsset[];
  onBroadcastSuccess: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  assets,
  onBroadcastSuccess,
}) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState(false);

  // Override Form State
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [confidence, setConfidence] = useState("95");
  const [entryPrice, setEntryPrice] = useState("64500");
  const [takeProfit, setTakeProfit] = useState("68000");
  const [stopLoss, setStopLoss] = useState("63000");
  const [rationale, setRationale] = useState(
    "LEAD QUANT ALERT: Federal Reserve liquidity injection & institutional spot ETF net inflows confirm high-probability continuation."
  );

  useEffect(() => {
    if (isOpen) {
      fetch("/api/admin/stats")
        .then((res) => res.json())
        .then((data) => setStats(data.stats))
        .catch((err) => console.error(err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcasting(true);

    try {
      const selected = assets.find((a) => a.symbol === symbol) || assets[0];
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          assetClass: selected.assetClass,
          direction,
          confidence: Number(confidence),
          entryPrice: Number(entryPrice),
          takeProfit: Number(takeProfit),
          stopLoss: Number(stopLoss),
          rationale,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBroadcastDone(true);
        onBroadcastSuccess();
        setTimeout(() => {
          setBroadcastDone(false);
          onClose();
        }, 2000);
      }
    } catch {
      alert("Failed to broadcast prediction signal");
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#101625] border border-indigo-700/50 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c101c]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Admin Control Terminal & Signal Override
              </h3>
              <p className="text-xs text-slate-400">
                Institutional Platform Telemetry & Market Broadcasting
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

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Telemetry Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold mb-1">
                <Users className="w-3 h-3 text-cyan-400" />
                Active Traders
              </div>
              <div className="text-lg font-black text-white">
                {stats?.activeUsers24h || 318}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold">+14% today</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold mb-1">
                <BarChart3 className="w-3 h-3 text-emerald-400" />
                Platform Volume
              </div>
              <div className="text-lg font-black text-white">
                ${(stats?.totalVolume || 8450200).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-slate-400">24h aggregate</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold mb-1">
                <DollarSign className="w-3 h-3 text-amber-400" />
                Revenue (Fees)
              </div>
              <div className="text-lg font-black text-emerald-400">
                ${(stats?.totalRevenue || 24650).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-slate-400">Spread cut</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold mb-1">
                <TrendingUp className="w-3 h-3 text-cyan-400" />
                Avg Win Rate
              </div>
              <div className="text-lg font-black text-cyan-400">
                {stats?.averageWinRate || "61.4%"}
              </div>
              <div className="text-[10px] text-slate-400">Risk engine target</div>
            </div>
          </div>

          {/* Signal Override Form */}
          <div className="bg-slate-900/90 border border-indigo-900/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
              <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-white">
                Push Market Prediction Override to All Users
              </h4>
            </div>

            {broadcastDone ? (
              <div className="py-6 flex flex-col items-center text-center animate-fade-in">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
                <h5 className="text-sm font-bold text-white">Signal Broadcasted!</h5>
                <p className="text-xs text-slate-400">
                  All active trader terminals have been refreshed with this signal.
                </p>
              </div>
            ) : (
              <form onSubmit={handleBroadcast} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Symbol</label>
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    >
                      {assets.map((a) => (
                        <option key={a.symbol} value={a.symbol}>
                          {a.symbol} ({a.assetClass})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Direction</label>
                    <select
                      value={direction}
                      onChange={(e) => setDirection(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    >
                      <option value="LONG">LONG (Buy)</option>
                      <option value="SHORT">SHORT (Sell)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Confidence %</label>
                    <input
                      type="number"
                      value={confidence}
                      onChange={(e) => setConfidence(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Suggested Entry</label>
                    <input
                      type="number"
                      step="any"
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-emerald-400 block mb-1 font-medium">Take Profit (TP)</label>
                    <input
                      type="number"
                      step="any"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-emerald-400 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-rose-400 block mb-1 font-medium">Stop Loss (SL)</label>
                    <input
                      type="number"
                      step="any"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-rose-400 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Market Rationale</label>
                  <textarea
                    rows={2}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>

                <button
                  type="submit"
                  disabled={broadcasting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  {broadcasting ? "Broadcasting Override..." : "Broadcast Institutional Prediction Alert"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
