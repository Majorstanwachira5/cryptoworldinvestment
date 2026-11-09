"use client";

import React from "react";
import { Home, BarChart3, BookOpen, Wallet } from "lucide-react";

export type NavSection = "HOME" | "TRADE" | "REFERRAL" | "PROFILE" | "MIKE_AI";

interface BottomNavProps {
  active: NavSection | "TRADES"; // Support legacy "TRADES" as alias for "TRADE"
  onSelect: (section: NavSection) => void;
  /** Small count badge, used for open positions on the Trade tab. */
  tradesBadge?: number;
  referralBadge?: number;
}

const ITEMS: {
  id: NavSection;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { id: "HOME", Icon: Home, label: "Home" },
  { id: "TRADE", Icon: BarChart3, label: "Market" },
  { id: "MIKE_AI", Icon: BookOpen, label: "Futures" },
  { id: "PROFILE", Icon: Wallet, label: "Wallet" },
];

/**
 * Modern Mobile Bottom Navigation Bar
 * Ocean Blue & Midnight Blue base with Acid Yellow (#e2ff3b) active state.
 * Fixed to viewport bottom with Android safe-area insets.
 */
export const BottomNav: React.FC<BottomNavProps> = ({
  active,
  onSelect,
  tradesBadge = 0,
}) => {
  const currentId = active === "TRADES" ? "TRADE" : active;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-50 border-t border-[#142848] bg-[#060c18]/95 dark:bg-[#060c18]/95 light:bg-white/95 backdrop-blur-xl md:hidden transition-colors"
    >
      <ul className="grid grid-cols-4 h-14 items-center">
        {ITEMS.map(({ id, Icon, label }) => {
          const isActive = currentId === id || (id === "PROFILE" && currentId === "REFERRAL");
          const badge = id === "TRADE" ? tradesBadge : 0;

          return (
            <li key={id} className="h-full">
              <button
                onClick={() => onSelect(id)}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className={`relative w-full h-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90 ${
                  isActive
                    ? "text-[#e2ff3b] font-black"
                    : "text-[#7c93b2] hover:text-white"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-[#e2ff3b] shadow-[0_0_10px_rgba(226,255,59,0.7)]" />
                )}
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive
                        ? "scale-105 text-[#e2ff3b] drop-shadow-[0_0_8px_rgba(226,255,59,0.5)]"
                        : "text-[#7c93b2]"
                    }`}
                  />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-3 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                  {id === "MIKE_AI" && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#e2ff3b] animate-pulse" />
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight leading-none mt-0.5 ${
                    isActive ? "font-bold text-[#e2ff3b]" : "font-medium text-[#7c93b2]"
                  }`}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {/* Android Safe Area Inset Support */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
};
