"use client";

import React, { useState } from "react";
import { MarketAsset, AssetClass } from "@/types";
import { Search, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";

interface AssetSelectorProps {
  assets: MarketAsset[];
  selectedAsset: MarketAsset;
  onSelectAsset: (asset: MarketAsset) => void;
}

export const AssetSelector: React.FC<AssetSelectorProps> = ({
  assets,
  selectedAsset,
  onSelectAsset,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<"ALL" | AssetClass>("ALL");

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.symbol.toLowerCase().includes(search.toLowerCase()) ||
      asset.name.toLowerCase().includes(search.toLowerCase());
    const matchesClass = filterClass === "ALL" || asset.assetClass === filterClass;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="relative">
      {/* Current Asset Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111724] border-b border-border px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-750 px-3 py-1.5 rounded-md border border-slate-700 text-white font-bold text-sm tracking-wide transition-all"
          >
            <span>{selectedAsset.symbol}</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-700 text-cyan-300">
              {selectedAsset.assetClass}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Real-time price badge */}
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-white tracking-tight">
              ${selectedAsset.currentPrice.toLocaleString("en-US", {
                minimumFractionDigits: selectedAsset.digits,
                maximumFractionDigits: selectedAsset.digits,
              })}
            </span>
            <span
              className={`flex items-center font-bold text-xs ${
                selectedAsset.change24h >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {selectedAsset.change24h >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
              )}
              {selectedAsset.change24h >= 0 ? "+" : ""}
              {selectedAsset.change24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* 24h Stats */}
        <div className="hidden sm:flex items-center gap-4 text-slate-400">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">24h High</span>
            <span className="font-semibold text-slate-200">${selectedAsset.high24h.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">24h Low</span>
            <span className="font-semibold text-slate-200">${selectedAsset.low24h.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">24h Volume</span>
            <span className="font-semibold text-cyan-400">{selectedAsset.volume24h}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">Spread</span>
            <span className="font-semibold text-slate-300">{selectedAsset.spread}</span>
          </div>
        </div>
      </div>

      {/* Asset Selection Modal Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-2 sm:left-4 z-50 mt-1 w-[calc(100vw-1rem)] max-w-sm rounded-xl bg-[#131a29] border border-slate-700 shadow-2xl p-3 animate-fade-in">
          {/* Search Box */}
          <div className="relative mb-2.5">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search crypto or forex pair..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              autoFocus
            />
          </div>

          {/* Market Tabs */}
          <div className="flex items-center gap-1.5 mb-2 border-b border-slate-800 pb-2">
            {(["ALL", "CRYPTO", "FOREX"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterClass(tab)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all ${
                  filterClass === tab
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Pair List */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {filteredAssets.map((asset) => (
              <button
                key={asset.symbol}
                onClick={() => {
                  onSelectAsset(asset);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                  selectedAsset.symbol === asset.symbol
                    ? "bg-slate-800 border border-cyan-500/40"
                    : "hover:bg-slate-800/60"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">{asset.symbol}</span>
                    <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {asset.assetClass}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{asset.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-xs text-white">
                    ${asset.currentPrice.toLocaleString("en-US", {
                      minimumFractionDigits: asset.digits,
                      maximumFractionDigits: asset.digits,
                    })}
                  </div>
                  <div
                    className={`text-[10px] font-medium ${
                      asset.change24h >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {asset.change24h >= 0 ? "+" : ""}
                    {asset.change24h.toFixed(2)}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
