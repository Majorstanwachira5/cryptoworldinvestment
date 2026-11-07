"use client";

import React, { useState } from "react";
import { Trade, AccountType } from "@/types";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Layers,
  ShieldCheck,
  XCircle,
} from "lucide-react";

interface PositionsTableProps {
  trades: Trade[];
  accountType: AccountType;
  onCloseTrade: (tradeId: string, currentPrice: number) => Promise<void>;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  trades,
  accountType,
  onCloseTrade,
}) => {
  const [activeTab, setActiveTab] = useState<"OPEN" | "CLOSED">("OPEN");
  const [closingId, setClosingId] = useState<string | null>(null);

  // Strictly filter by account type
  const accountTrades = trades.filter((t) => (t.accountType || "REAL") === accountType);
  const openPositions = accountTrades.filter((t) => t.status === "OPEN");
  const closedPositions = accountTrades.filter((t) => t.status === "CLOSED");

  const displayedTrades = activeTab === "OPEN" ? openPositions : closedPositions;

  const handleClose = async (trade: Trade) => {
    setClosingId(trade.id);
    await onCloseTrade(trade.id, trade.currentPrice);
    setClosingId(null);
  };

  return (
    <div className="bg-[#0f1422] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2.5 bg-[#111726] border-b border-slate-800 text-xs gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("OPEN")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === "OPEN"
                ? "bg-slate-800 text-cyan-400 border border-slate-700"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Open ({openPositions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("CLOSED")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === "CLOSED"
                ? "bg-slate-800 text-cyan-400 border border-slate-700"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>History ({closedPositions.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
              accountType === "REAL"
                ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                : "bg-cyan-950 text-cyan-300 border-cyan-800"
            }`}
          >
            {accountType} LEDGER
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Mark-to-Market PnL
          </span>
        </div>
      </div>

      {/* Mobile Card Layout (visible on narrow screens < 768px) */}
      <div className="md:hidden divide-y divide-slate-800/60 p-2 space-y-2">
        {displayedTrades.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-normal">
            {activeTab === "OPEN"
              ? `No open ${accountType} positions.`
              : `No closed ${accountType} trade history yet.`}
          </div>
        ) : (
          displayedTrades.map((trade) => {
            const isProfit = trade.pnl >= 0;
            const isLong = trade.direction === "LONG";
            return (
              <div
                key={trade.id}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                        isLong
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                      }`}
                    >
                      {trade.direction}
                    </span>
                    <span className="font-extrabold text-white text-sm">{trade.symbol}</span>
                    <span className="text-[10px] text-cyan-400 font-bold">{trade.leverage}x</span>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-sm font-black flex items-center justify-end gap-1 ${
                        isProfit ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isProfit ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      <span>{isProfit ? "+" : "-"}${Math.abs(trade.pnl).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-900">
                  <div>
                    <span className="text-slate-500">Size: </span>
                    <span className="text-slate-200 font-bold">{trade.size}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Margin: </span>
                    <span className="text-slate-200 font-bold">${trade.margin.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Entry: </span>
                    <span className="text-slate-200">${trade.entryPrice.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Current: </span>
                    <span className="text-white font-bold">${trade.currentPrice.toLocaleString()}</span>
                  </div>
                  {trade.stopLoss && (
                    <div>
                      <span className="text-rose-400 font-semibold">SL: </span>
                      <span className="text-slate-300">${trade.stopLoss}</span>
                    </div>
                  )}
                  {trade.takeProfit && (
                    <div>
                      <span className="text-emerald-400 font-semibold">TP: </span>
                      <span className="text-slate-300">${trade.takeProfit}</span>
                    </div>
                  )}
                </div>

                {activeTab === "OPEN" && (
                  <button
                    onClick={() => handleClose(trade)}
                    disabled={closingId === trade.id}
                    className="w-full mt-2 bg-slate-800 hover:bg-rose-950/80 hover:text-rose-400 text-slate-300 border border-slate-700 hover:border-rose-800/80 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{closingId === trade.id ? "Closing..." : "Close Position"}</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop/Tablet Table Layout (hidden on < 768px) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0d121c] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Symbol / Side</th>
              <th className="py-2.5 px-3">Size & Lev</th>
              <th className="py-2.5 px-3">Entry Price</th>
              <th className="py-2.5 px-3">Mark Price</th>
              <th className="py-2.5 px-3">Margin</th>
              <th className="py-2.5 px-3">SL / TP</th>
              <th className="py-2.5 px-3">Liq Price</th>
              <th className="py-2.5 px-3">PnL & Pips</th>
              {activeTab === "OPEN" && <th className="py-2.5 px-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {displayedTrades.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="py-8 text-center text-slate-500 font-normal"
                >
                  {activeTab === "OPEN"
                    ? `No open ${accountType} positions. Use the Trade Ticket or Prediction Engine to initiate an order.`
                    : `No closed ${accountType} trade history yet.`}
                </td>
              </tr>
            ) : (
              displayedTrades.map((trade) => {
                const isProfit = trade.pnl >= 0;
                const isLong = trade.direction === "LONG";
                return (
                  <tr
                    key={trade.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Symbol & Direction */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                            isLong
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          }`}
                        >
                          {trade.direction}
                        </span>
                        <span className="font-bold text-white text-xs">
                          {trade.symbol}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {new Date(trade.openedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>

                    {/* Size & Leverage */}
                    <td className="py-3 px-3">
                      <span className="font-semibold text-white">
                        {trade.size} {trade.assetClass === "FOREX" ? "Lots" : "Units"}
                      </span>
                      <span className="text-[10px] text-cyan-400 block">
                        {trade.leverage}x
                      </span>
                    </td>

                    {/* Entry Price */}
                    <td className="py-3 px-3 text-slate-200">
                      ${trade.entryPrice.toLocaleString()}
                    </td>

                    {/* Mark Price */}
                    <td className="py-3 px-3 text-white font-semibold">
                      ${trade.currentPrice.toLocaleString()}
                    </td>

                    {/* Margin */}
                    <td className="py-3 px-3 text-slate-300">
                      ${trade.margin.toFixed(2)}
                    </td>

                    {/* SL / TP */}
                    <td className="py-3 px-3 text-[11px]">
                      <div className="text-rose-400 font-semibold">
                        SL: {trade.stopLoss ? `$${trade.stopLoss}` : "—"}
                      </div>
                      <div className="text-emerald-400 font-semibold">
                        TP: {trade.takeProfit ? `$${trade.takeProfit}` : "—"}
                      </div>
                    </td>

                    {/* Liquidation Price */}
                    <td className="py-3 px-3 text-amber-400/90 font-mono text-[11px]">
                      {trade.liquidationPrice ? `$${trade.liquidationPrice}` : "—"}
                    </td>

                    {/* PnL & Pips */}
                    <td className="py-3 px-3">
                      <div
                        className={`flex items-center gap-1 font-bold text-xs ${
                          isProfit ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isProfit ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        <span className="text-sm font-black">
                          {isProfit ? "+" : "-"}${Math.abs(trade.pnl).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                            isProfit
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          }`}
                        >
                          {isProfit ? "PROFIT WIN" : "CONTROLLED LOSS"}
                        </span>
                        {trade.assetClass === "FOREX" && (
                          <span className="text-[10px] text-slate-400">
                            {trade.pips > 0 ? `+${trade.pips}` : trade.pips} pips
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    {activeTab === "OPEN" && (
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleClose(trade)}
                          disabled={closingId === trade.id}
                          className="bg-slate-800 hover:bg-rose-950/80 hover:text-rose-400 text-slate-300 border border-slate-700 hover:border-rose-800/80 px-2.5 py-1 rounded text-xs font-semibold transition-all"
                        >
                          {closingId === trade.id ? "Closing..." : "Close"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
