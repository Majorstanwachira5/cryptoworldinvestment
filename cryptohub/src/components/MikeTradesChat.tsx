"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  RotateCcw,
  Bot,
  User,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  HelpCircle,
} from "lucide-react";
import { authFetch } from "@/lib/auth/session";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const SUGGESTED_QUESTIONS = [
  "How does quantitative risk management work?",
  "How do Account Levels 1–3 and Daily Auto-Trade rewards work?",
  "Why is Stop Loss mandatory on live trades?",
  "How do I earn $30 with the referral program?",
  "How do I read RSI and MACD predictions?",
  "How do I deposit TRC20 USDT into my account?",
];

const INITIAL_MESSAGE: Message = {
  id: "init_mike_01",
  role: "assistant",
  content: `Hello! I am **Mike Trades**, your institutional trading assistant on CryptoWorldInvestment (CWI).

I am here to help you navigate our quantitative trading tools, explain our **quantitative risk management framework**, understand indicator predictions, and maximize your learning.

How can I assist your trading journey today?`,
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
};

export const MikeTradesChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);

    // Client-side guardrail check
    const prohibited = [
      /\badmin\b/i, /\badministrator\b/i, /\bsudo\b/i, /\broot\b/i,
      /\badmin\s+access\b/i, /\bescalat/i, /\boverride\b/i, /\bbypass\b/i,
      /\buser\s*id\b/i, /\buid\b/i, /\baccount\s*id\b/i, /\bpassword\b/i,
      /\bbalance\b/i, /\bdatabase\b/i, /\bsystem\s+prompt\b/i
    ];
    if (prohibited.some((p) => p.test(text))) {
      setTimeout(() => {
        const securityMessage: Message = {
          id: `msg_mike_sec_${Date.now()}`,
          role: "assistant",
          content: `### 🛡️ CryptoWorldInvestment Security Enforcement Notice\n\n**Access Denied.** Mike Trades operates under zero-trust institutional security policies:\n\n* **Strict Privacy Isolation:** Mike Trades is cryptographically isolated from private user data, including backend User IDs, personal credentials, passwords, and account balances.\n* **Administrative Governance:** Inquiries or commands attempting to query administrative systems, alter privilege levels, access backend databases, or override security boundaries are strictly blocked, monitored, and logged.\n\nMike Trades is authorized exclusively to assist with **market technical analysis**, **chart indicators**, and **quantitative risk management rules**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, securityMessage]);
      }, 400);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      const res = await authFetch("/api/mike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success && data.message) {
        const assistantMessage: Message = {
          id: `msg_mike_${Date.now()}`,
          role: "assistant",
          content: data.message,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setError(data.error || "Unable to get a response. Please retry.");
      }
    } catch {
      setError("Network connection issue. Please check your connectivity and retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setError(null);
    setInput("");
  };

  // Helper to format simple markdown (bold, lists, headings)
  const renderFormattedContent = (content: string) => {
    const lines = content.split("\n");
    return (
      <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith("### ")) {
            return (
              <h4 key={idx} className="font-extrabold text-sm sm:text-base text-cyan-400 mt-2 mb-1">
                {line.replace("### ", "")}
              </h4>
            );
          }
          if (line.startsWith("* ") || line.startsWith("- ")) {
            const rawText = line.substring(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-cyan-400 mt-1 font-bold">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatBold(rawText) }} />
              </div>
            );
          }
          if (line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ")) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-cyan-400 font-bold">{line.substring(0, 3)}</span>
                <span dangerouslySetInnerHTML={{ __html: formatBold(line.substring(3)) }} />
              </div>
            );
          }
          if (line.trim() === "") {
            return <div key={idx} className="h-1" />;
          }
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatBold(line) }} />
          );
        })}
      </div>
    );
  };

  function formatBold(str: string): string {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-extrabold text-white">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px]">$1</code>');
  }

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] md:h-[calc(100vh-80px)] max-w-4xl mx-auto w-full p-2 sm:p-4">
      {/* Assistant Header Card */}
      <div className="bg-gradient-to-r from-[#101726] to-[#0c111c] border border-cyan-500/20 rounded-xl p-3 sm:p-4 shadow-lg mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-cyan-500/30">
              <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base text-white">Mike Trades</h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                AI Assistant
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              CryptoWorldInvestment Quantitative Intelligence & Platform Guide
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          title="Start a new conversation"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 sm:pr-2 scrollbar-thin">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex gap-2.5 sm:gap-3 ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
            >
              {!isUser && (
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center shrink-0 mt-0.5 text-cyan-400">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3 sm:p-4 shadow-md ${
                  isUser
                    ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-tr-xs"
                    : "bg-[#111724] border border-slate-800/90 text-slate-200 rounded-tl-xs"
                }`}
              >
                {isUser ? (
                  <p className="text-xs sm:text-sm font-medium">{m.content}</p>
                ) : (
                  renderFormattedContent(m.content)
                )}

                <div
                  className={`mt-2 text-[9px] font-mono text-right ${
                    isUser ? "text-cyan-200/80" : "text-slate-500"
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>

              {isUser && (
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center shrink-0 mt-0.5 text-indigo-400">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Typing Indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs pl-2 py-1 animate-pulse">
            <div className="h-6 w-6 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex gap-1 items-center bg-[#111724] border border-slate-800 px-3 py-2 rounded-xl">
              <span className="text-[11px] text-slate-400 mr-1">Mike is analyzing</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Chips */}
      {messages.length <= 2 && (
        <div className="pt-2 pb-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <HelpCircle className="w-3 h-3 text-cyan-400" /> Suggested Inquiries
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTED_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="whitespace-nowrap bg-slate-900/90 hover:bg-slate-800/90 text-slate-300 hover:text-white border border-slate-800 hover:border-cyan-500/40 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
              >
                <span>{q}</span>
                <ArrowRight className="w-3 h-3 text-cyan-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="mt-2 bg-[#111724] border border-slate-800 rounded-xl p-1.5 sm:p-2 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Mike about trading, risk management, indicators..."
          disabled={loading}
          className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-black flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:scale-100 active:scale-95 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Educational Notice */}
      <div className="mt-2 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
        <Sparkles className="w-3 h-3 text-cyan-400" />
        <span>Mike Trades provides educational guidance. Trading involves market risk.</span>
      </div>
    </div>
  );
};
