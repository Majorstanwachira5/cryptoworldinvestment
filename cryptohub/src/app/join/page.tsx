"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Gift, ShieldCheck } from "lucide-react";

function JoinRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const rawRef = searchParams.get("ref") || "";
    const normalized = rawRef.trim().toUpperCase();
    setReferralCode(normalized);

    if (normalized) {
      try {
        window.localStorage.setItem("cwi_referral_code", normalized);
      } catch {
        // Ignore storage restrictions.
      }
      router.replace(`/?ref=${encodeURIComponent(normalized)}&register=1`);
    } else {
      router.replace("/?register=1");
    }
  }, [router, searchParams]);

  const targetHref = referralCode
    ? `/?ref=${encodeURIComponent(referralCode)}&register=1`
    : "/?register=1";

  return (
    <div className="min-h-screen bg-[#060a13] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0b1120] p-6 shadow-2xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30">
          <Gift className="h-6 w-6 text-cyan-400" />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-white">
          CryptoWorldInvestment Invitation
        </h1>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          {referralCode
            ? `Applying referral code ${referralCode} and opening registration on our official platform.`
            : "Redirecting to registration on our official platform."}
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-[11px] font-medium text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified Domain: cryptoworldinvest.world
        </div>
        <div className="mt-6">
          <a
            href={targetHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2.5 text-xs font-bold text-white transition-colors"
          >
            Continue to Sign Up
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060a13] text-slate-300 flex items-center justify-center text-xs">
          Loading invitation...
        </div>
      }
    >
      <JoinRedirectContent />
    </Suspense>
  );
}

