import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { credentials } from "@/lib/auth/credentials";
import { requirePermission, platformUserId } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

/**
 * The correct answers to the real-account risk certification.
 *
 * These are held server-side so the quiz cannot be completed by guessing what
 * the client will accept.
 */
const CORRECT_ANSWERS = {
  q1: "2",
  q2: "sl",
  q3: "prob",
} as const;

/**
 * Records a passed real-account risk certification.
 *
 * The caller must already hold a valid access token and be permitted to trade
 * the real book: certification is only meaningful for someone who could trade
 * it. Wrong answers are rejected with 422 and nothing is recorded.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, "trade:real");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { q1?: string; q2?: string; q3?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const wrong = (Object.keys(CORRECT_ANSWERS) as (keyof typeof CORRECT_ANSWERS)[]).filter(
    (key) => body[key] !== CORRECT_ANSWERS[key]
  );

  if (wrong.length > 0) {
    return NextResponse.json(
      {
        error:
          "Certification not recorded. Review the risk framework: position sizing, stop placement, and why outcomes are probabilistic.",
      },
      { status: 422 }
    );
  }

  const certifiedAt = new Date().toISOString();
  const userId = platformUserId(auth.identity);
  const user = credentials.certifyRisk(userId, certifiedAt);

  if (!user) {
    return NextResponse.json(
      { error: "This account is not recognised by the credential store." },
      { status: 404 }
    );
  }

  // Recorded on the trading profile too, so the account surfaces as certified
  // wherever that flag is read.
  db.completeRiskQuiz(userId);

  return NextResponse.json({
    success: true,
    riskCertifiedAt: certifiedAt,
    user: { ...user, provider: auth.identity.user.provider },
  });
}
