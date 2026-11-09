"use client";

import React from "react";

interface CwiLogoProps {
  size?: number;
  showText?: boolean;
  textSubtitle?: string;
  className?: string;
  variant?: "icon" | "horizontal" | "badge";
}

/**
 * CryptoWorldInvestment (CWI) Official Brand Emblem
 * Symbolism:
 * - Interlocking Globe Meridians: Global Trade & 24/7 Liquidity
 * - Ascending Chevron Wings: Freedom, Upward Growth & Victory ("Winning")
 * - Radiant Zenith Star: Financial Sovereignty & Triumph
 * Colors: Midnight Blue (#050b14), Ocean Blue (#0ea5e9), Acid Yellow (#e2ff3b)
 */
export const CwiLogo: React.FC<CwiLogoProps> = ({
  size = 36,
  showText = false,
  textSubtitle = "Financial Freedom Built on Trade & Winning",
  className = "",
  variant = "horizontal",
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* CWI Vector Emblem */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 hover:scale-105"
      >
        <defs>
          {/* Midnight Blue Background Radial */}
          <radialGradient id="cwi-bg-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0b2246" />
            <stop offset="60%" stopColor="#061226" />
            <stop offset="100%" stopColor="#030814" />
          </radialGradient>

          {/* Ocean Blue Gradient */}
          <linearGradient id="cwi-ocean-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="50%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* High-Voltage Acid Yellow Gradient */}
          <linearGradient id="cwi-acid-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d4f52e" />
            <stop offset="50%" stopColor="#e2ff3b" />
            <stop offset="100%" stopColor="#f4ff7a" />
          </linearGradient>

          {/* Ambient Glow Filter */}
          <filter id="cwi-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hex-Shield / Squircle Base */}
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="24"
          fill="url(#cwi-bg-grad)"
          stroke="#163660"
          strokeWidth="2.5"
        />

        {/* Global Trade Orbital Meridians (The 'World') */}
        <ellipse
          cx="50"
          cy="50"
          rx="38"
          ry="15"
          transform="rotate(-25 50 50)"
          stroke="#0ea5e9"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          strokeOpacity="0.45"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="38"
          ry="15"
          transform="rotate(35 50 50)"
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeDasharray="5 3"
          strokeOpacity="0.35"
        />
        <circle
          cx="50"
          cy="50"
          r="34"
          stroke="#0284c7"
          strokeWidth="1.5"
          strokeOpacity="0.3"
        />

        {/* Freedom Wings / Winning "W" & "V" Chevron Vector */}
        {/* Left Wing (Rising) */}
        <path
          d="M20 64L38 48L46 62L32 72Z"
          fill="url(#cwi-ocean-grad)"
          fillOpacity="0.8"
        />
        {/* Right Wing (Rising Ascendance) */}
        <path
          d="M80 64L62 48L54 62L68 72Z"
          fill="url(#cwi-ocean-grad)"
          fillOpacity="0.8"
        />

        {/* Central Trade Candlestick Core (Ascending Capital) */}
        <rect x="48.5" y="66" width="3" height="12" rx="1.5" fill="#38bdf8" fillOpacity="0.6" />
        <rect x="47" y="44" width="6" height="24" rx="2" fill="url(#cwi-ocean-grad)" />

        {/* Sovereign Victory Arrow / Freedom Spear (Acid Yellow) */}
        <path
          d="M50 20L64 42L54 40L50 33L46 40L36 42L50 20Z"
          fill="url(#cwi-acid-grad)"
          filter="url(#cwi-glow)"
        />

        {/* Radiant Zenith Diamond Star (Freedom & Winning Pinnacle) */}
        <path
          d="M50 14L52.5 19L57 20L52.5 21L50 26L47.5 21L43 20L47.5 19Z"
          fill="#ffffff"
        />
        <circle cx="50" cy="20" r="1.5" fill="#e2ff3b" />

        {/* Small Trading Milestone Orbit Nodes */}
        <circle cx="28" cy="36" r="2" fill="#38bdf8" />
        <circle cx="72" cy="38" r="2.5" fill="#e2ff3b" filter="url(#cwi-glow)" />
      </svg>

      {/* Brand Typography */}
      {(showText || variant === "horizontal") && (
        <div className="flex flex-col min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm sm:text-base tracking-tight text-white dark:text-white light:text-slate-900">
              CryptoWorld<span className="text-[#e2ff3b]">Investment</span>
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-[#071d3a] text-[#38bdf8] border border-[#144588] tracking-wider">
              CWI
            </span>
          </div>
          <span className="text-[10px] text-[#7c93b2] font-medium tracking-tight truncate hidden xs:block">
            {textSubtitle}
          </span>
        </div>
      )}
    </div>
  );
};

export default CwiLogo;
