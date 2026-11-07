"use client";

import React from "react";
import { Sparkles, Bot } from "lucide-react";

interface FloatingMikeButtonProps {
  onClick: () => void;
  visible: boolean;
}

export const FloatingMikeButton: React.FC<FloatingMikeButtonProps> = ({ onClick, visible }) => {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      aria-label="Open Mike Trades AI Assistant"
      title="Ask Mike Trades AI Assistant"
      className="fixed bottom-20 right-4 z-40 md:hidden h-12 w-12 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-500 to-emerald-400 text-slate-950 flex items-center justify-center transition-all hover:scale-105 active:scale-90 border-2 border-slate-900 group"
    >
      <div className="relative">
        <Bot className="w-6 h-6 text-slate-950" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950 animate-pulse" />
      </div>
      <span className="sr-only">Ask Mike Trades</span>
    </button>
  );
};
