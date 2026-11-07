"use client";

import React from "react";
import { Home, TrendingUp, Gift, User, Sparkles } from "lucide-react";

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
  { id: "TRADE", Icon: TrendingUp, label: "Trade" },
  { id: "REFERRAL", Icon: Gift, label: "Referral" },
  { id: "PROFILE", Icon: User, label: "Profile" },
  { id: "MIKE_AI", Icon: Sparkles, label: "Mike AI" },
];

/**
 * Android Mobile Bottom Navigation Bar
 * 5 primary sections: HOME | TRADE | REFERRAL | PROFILE | MIKE AI
 * Fixed to viewport bottom with Android safe-area insets and touch targets >= 48px.
 */
export const BottomNav: React.FC<BottomNavProps> = ({
  active,
  onSelect,
  tradesBadge = 0,
  referralBadge = 0,
}) => {
  const currentId = active === "TRADES" ? "TRADE" : active;

  return (
    <nav
      aria-label="Android Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-50 border-t border-slate-800/80 bg-[#0d121c]/95 dark:bg-[#0d121c]/95 light:bg-white/95 backdrop-blur-lg md:hidden transition-colors"
    >
      <ul className="grid grid-cols-5 h-14 items-center">
        {ITEMS.map(({ id, Icon, label }) => {
          const isActive = currentId === id;
          const badge =
            id === "TRADE" ? tradesBadge : id === "REFERRAL" ? referralBadge : 0;

          return (
            <li key={id} className="h-full">
              <button
                onClick={() => onSelect(id)}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className={`relative w-full h-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90 ${
                  isActive
                    ? "text-cyan-400 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-cyan-400" />
                )}
                <div className="relative">
                  <Icon
                    className={`w-4 h-4 transition-transform ${
                      isActive ? "scale-110 text-cyan-400" : ""
                    }`}
                  />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-3 min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-500 text-slate-950 text-[8px] font-black flex items-center justify-center">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                  {id === "MIKE_AI" && !isActive && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight leading-none ${
                    isActive ? "font-bold text-cyan-400" : "font-medium"
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