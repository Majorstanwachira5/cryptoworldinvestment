"use client";

import React, { useMemo, useState } from "react";
import { AccountType, Trade } from "@/types";
import { formatMoney, formatSignedMoney } from "@/lib/fx/rates";
import { LineChart, XCircle, Layers, Filter } from "lucide-react";

interface TradesPanelProps {
  trades: Trade[];
  accountType: AccountType;
  currency: "USD" | "KES";
  onCloseTrade: (tradeId: string, exitPrice: number) => void;
}

type FilterKey = "ALL" | "OPEN" | "CLOSED" | "WIN" | "LOSS";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "CLOSED", label: "Closed" },
  { key: "WIN", label: "Wins" },
  { key: "LOSS", label: "Losses" },
];

export const TradesPanel: React.FC<TradesPanelProps> = ({
  trades,
  accountType,
  currency,
  onCloseTrade,
}) => {
  const [filter, setFilter] = useState<FilterKey>("ALL");

  const scoped = useMemo(
    () => trades.filter((t) => (t.accountType || "REAL") === accountType),
    [trades, accountType]
  );

  const visible = useMemo(() => {
    switch (filter) {
      case "OPEN":
        return scoped.filter((t) => t.status === "OPEN");
      case "CLOSED":
        return scoped.filter((t) => t.status === "CLOSED");
      case "WIN":
        return scoped.filter((t) => t.status === "CLOSED" && t.pnl > 0);
      case "LOSS":
        return scoped.filter((t) => t.status === "CLOSED" && t.pnl < 0);
      default:
        return scoped;
    }
  }, [scoped, filter]);

  const totals = useMemo(() => {
    const closed = scoped.filter((t) => t.status === "CLOSED");
    const wins = closed.filter((t) => t.pnl > 0);
    const net = closed.reduce((a, t) => a + t.pnl, 0);
    return {
      total: scoped.length,
      open: scoped.filter((t) => t.status === "OPEN").length,
      winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
      net,
    };
  }, [scoped]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-b from-[#101726] to-[#0c111c] border border-cyan-500/20 rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <LineChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white tracking-wide">
              TRADE HISTORY — {accountType}
            </h3>
            <p className="text-[11px] text-slate-400">
              Every position opened on this account, open and closed
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500">Total trades</div>
            <div className="text-lg font-black text-white">{totals.total}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500">Open now</div>
            <div className="text-lg font-black text-amber-400">{totals.open}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500">Win rate</div>
            <div className="text-lg font-black text-slate-200">
              {totals.total - totals.open > 0 ? `${totals.winRate.toFixed(0)}%` : "—"}
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-slate-500">Realised PnL</div>
            <div
              className={`text-lg font-black ${
                totals.net >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatSignedMoney(totals.net, currency)}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  filter === f.key
                    ? "bg-cyan-500 text-slate-950 shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-10">
            <Layers className="w-8 h-8 text-slate-700 mx-auto" />
            <p className="text-xs text-slate-500 mt-2">
              No {filter === "ALL" ? "" : filter.toLowerCase() + " "}trades on this account yet.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {visible.map((t) => {
              const isOpen = t.status === "OPEN";
              const pnlTone = isOpen
                ? t.pnl >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
                : t.pnl > 0
                  ? "text-emerald-400"
                  : t.pnl < 0
                    ? "text-rose-400"
                    : "text-slate-400";

              return (
                <div
                  key={t.id}
                  className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded border shrink-0 ${
                          t.direction === "LONG"
                            ? "bg-emerald-950/70 text-emerald-400 border-emerald-800"
                            : "bg-rose-950/70 text-rose-400 border-rose-800"
                        }`}
                      >
                        {t.direction}
                      </span>
                      <span className="text-xs font-bold text-white shrink-0">{t.symbol}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {t.size} @ {t.entryPrice}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-black ${pnlTone}`}
                      >
                        {formatSignedMoney(t.pnl, currency)}
                      </span>
                      {isOpen ? (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border bg-amber-950/70 text-amber-400 border-amber-800">
                          Open
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                            t.pnl > 0
                              ? "bg-emerald-950/70 text-emerald-400 border-emerald-800"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[10px] text-slate-500">
                    <span>Lev {t.leverage}x</span>
                    <span>Margin {formatMoney(t.margin, currency)}</span>
                    {t.stopLoss && <span>SL {t.stopLoss}</span>}
                    {t.takeProfit && <span>TP {t.takeProfit}</span>}
                    <span>
                      {new Date(t.openedAt).toLocaleString("en-KE")}
                      {t.closedAt ? ` → ${new Date(t.closedAt).toLocaleString("en-KE")}` : ""}
                    </span>
                    {isOpen && (
                      <button
                        onClick={() => onCloseTrade(t.id, t.currentPrice)}
                        className="ml-auto flex items-center gap-1 text-rose-400 hover:text-rose-300 font-bold"
                      >
                        <XCircle className="w-3 h-3" /> Close
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};