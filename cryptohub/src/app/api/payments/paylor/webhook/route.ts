import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { BlockchainLedgerService, TRON_USDT_CONTRACT } from "@/lib/ledger/trc20";
import { RewardEngine } from "@/lib/rewards/engine";
import { AuditService } from "@/lib/audit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const webhookSecret =
    process.env.PAYLOR_WEBHOOK_SECRET ||
    "7cac3823878d18d1fef3fdd19370ec67942bf5b3abb17f21be7fc0b2e68db98e";

  const rawBody = await request.text();
  const signature =
    request.headers.get("x-paylor-signature") ||
    request.headers.get("signature") ||
    request.headers.get("x-signature");

  if (!signature) {
    AuditService.log({
      actor: "PAYLOR_WEBHOOK",
      action: "WEBHOOK_REJECTED",
      target: "SYSTEM",
      outcome: "REJECTED",
      details: { reason: "Missing signature header" },
    });
    return NextResponse.json(
      { success: false, error: "Missing x-paylor-signature header" },
      { status: 401 }
    );
  }

  // Recompute HMAC SHA-256
  const computedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  // Constant-time signature comparison to eliminate timing attacks
  const signatureBuffer = Buffer.from(signature);
  const computedBuffer = Buffer.from(computedSignature);

  if (
    signatureBuffer.length !== computedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, computedBuffer)
  ) {
    AuditService.log({
      actor: "PAYLOR_WEBHOOK",
      action: "WEBHOOK_REJECTED",
      target: "SYSTEM",
      outcome: "REJECTED",
      details: { reason: "Invalid HMAC SHA-256 signature mismatch" },
    });
    return NextResponse.json(
      { success: false, error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  let eventPayload: any;
  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, error: "Malformed JSON payload" },
      { status: 400 }
    );
  }

  // Authoritative Rule: USDT on TRON (TRC20) only. Any other asset or network must not credit.
  const asset = (eventPayload.asset || eventPayload.currency || "USDT").toUpperCase();
  const network = (eventPayload.network || "TRC20").toUpperCase();
  const contract = eventPayload.contractAddress || TRON_USDT_CONTRACT;

  if (asset !== "USDT" || network !== "TRC20") {
    AuditService.log({
      actor: "PAYLOR_WEBHOOK",
      action: "DEPOSIT_REJECTED",
      target: eventPayload.userId || "UNKNOWN",
      outcome: "REJECTED",
      details: { reason: `Asset (${asset}) or network (${network}) not supported. TRC20 USDT only.` },
    });
    return NextResponse.json(
      { success: false, error: "Only USDT on TRON (TRC20) is accepted for deposit credits." },
      { status: 400 }
    );
  }

  const txHash = (
    eventPayload.txHash ||
    eventPayload.transaction_hash ||
    eventPayload.reference ||
    `payl_tx_${Date.now()}`
  )
    .trim()
    .toLowerCase();

  const amount = Number(eventPayload.amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid deposit amount in payload" },
      { status: 400 }
    );
  }

  // Extract user identity
  const userId =
    eventPayload.userId ||
    eventPayload.metadata?.userId ||
    eventPayload.customer_id ||
    "00000000-0000-0000-0000-000000000001"; // Default trader user

  // Process deposit idempotently
  const result = BlockchainLedgerService.processTRC20Deposit({
    userId,
    txHash,
    fromAddress: eventPayload.fromAddress || "TRC20_SENDER_WALLET",
    toAddress: eventPayload.toAddress || process.env.PAYLOR_TRON_WALLET || "TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd",
    amount,
    contractAddress: contract,
    confirmations: Number(eventPayload.confirmations || 19),
  });

  if (!result.ok) {
    // If already credited, return 200 with idempotent acknowledgment
    if (result.error && result.error.includes("already been credited")) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: "Transaction has already been credited.",
      });
    }
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  // Re-derive level
  const newLevel = RewardEngine.deriveUserLevel(userId);

  AuditService.log({
    actor: "PAYLOR_WEBHOOK",
    action: "DEPOSIT_CONFIRMED",
    target: userId,
    outcome: "SUCCESS",
    details: {
      amount,
      txHash,
      newLevel: newLevel.effectiveLevel,
      cumulativeDeposits: newLevel.cumulativeDeposits,
    },
  });

  return NextResponse.json({
    success: true,
    credited: true,
    txHash,
    amount,
    userLevel: newLevel,
  });
}
