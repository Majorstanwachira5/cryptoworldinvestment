"use client";

import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0e14] text-white p-4">
      <h2 className="text-2xl font-bold text-red-400 mb-2">Something went wrong</h2>
      <p className="text-slate-400 mb-6 max-w-md text-center text-sm">
        {error.message || "An unexpected error occurred in the trading terminal."}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm font-medium transition-all"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 text-sm font-semibold transition-all"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
