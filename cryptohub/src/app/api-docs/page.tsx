"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Terminal, BookOpen, ChevronRight, Lock, Check } from "lucide-react";
import swaggerSpec from "./swagger.json";

export default function ApiDocsPage() {
  const [activeTag, setActiveTag] = useState<string>("ALL");
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const paths = swaggerSpec.paths || {};
  const endpoints = Object.entries(paths).flatMap(([path, methods]) =>
    Object.entries(methods as Record<string, any>).map(([method, details]) => ({
      path,
      method: method.toUpperCase(),
      summary: details.summary || "",
      description: details.description || "",
      tags: details.tags || ["General"],
      parameters: details.parameters || [],
      requestBody: details.requestBody || null,
      responses: details.responses || {},
    }))
  );

  const allTags = ["ALL", ...Array.from(new Set(endpoints.flatMap((e) => e.tags)))];
  const filteredEndpoints =
    activeTag === "ALL"
      ? endpoints
      : endpoints.filter((e) => e.tags.includes(activeTag));

  const copyPath = (p: string) => {
    navigator.clipboard.writeText(p);
    setCopiedPath(p);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  const getMethodBadge = (m: string) => {
    switch (m) {
      case "GET":
        return "bg-cyan-500/15 text-cyan-400 border-cyan-500/40";
      case "POST":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
      case "PUT":
      case "PATCH":
        return "bg-amber-500/15 text-amber-400 border-amber-500/40";
      case "DELETE":
        return "bg-rose-500/15 text-rose-400 border-rose-500/40";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex flex-col font-sans">
      {/* Top Banner */}
      <header className="bg-[#101625] border-b border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Terminal</span>
          </Link>
          <div className="h-4 w-[1px] bg-slate-700 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h1 className="text-xs sm:text-sm font-bold tracking-wide text-white">
              CryptoWorldInvestment (CWI) OpenAPI 3.0 Documentation
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[10px] sm:text-xs font-mono text-emerald-400">
            <Shield className="w-3 h-3" />
            REAL • Live Ledger
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Info Card */}
        <div className="bg-[#101625] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-cyan-400 mb-2">
            <BookOpen className="w-5 h-5" />
            <h2 className="text-base font-bold text-white">{swaggerSpec.info.title}</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
              v{swaggerSpec.info.version}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            {swaggerSpec.info.description}
          </p>

          {/* Tag Filter Pills */}
          <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-800/80">
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTag === t
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Endpoints List */}
        <div className="space-y-3">
          {filteredEndpoints.map((ep, idx) => (
            <div
              key={`${ep.method}-${ep.path}-${idx}`}
              className="bg-[#101625] border border-slate-800 rounded-xl p-4 transition-colors hover:border-slate-700"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black border font-mono tracking-wider ${getMethodBadge(
                      ep.method
                    )}`}
                  >
                    {ep.method}
                  </span>
                  <code
                    onClick={() => copyPath(ep.path)}
                    className="font-mono text-xs text-white hover:text-cyan-400 cursor-pointer transition-colors"
                    title="Click to copy path"
                  >
                    {ep.path}
                  </code>
                  {copiedPath === ep.path && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Copied
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {ep.tags.map((t: string) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 border border-slate-800 text-slate-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {ep.summary && (
                <p className="text-xs text-slate-300 font-medium mt-2">{ep.summary}</p>
              )}
              {ep.description && ep.description !== ep.summary && (
                <p className="text-[11px] text-slate-400 mt-0.5">{ep.description}</p>
              )}

              {/* Request Details Preview */}
              {ep.requestBody && ep.requestBody.content?.["application/json"]?.schema?.properties && (
                <div className="mt-3 pt-3 border-t border-slate-800/60 bg-slate-950/60 p-2.5 rounded-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Request Payload:
                  </span>
                  <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-300">
                    {Object.keys(ep.requestBody.content["application/json"].schema.properties).map(
                      (k) => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                          {k}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
