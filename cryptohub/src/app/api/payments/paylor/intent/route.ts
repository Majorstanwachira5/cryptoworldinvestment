import { NextRequest, NextResponse } from "next/server";
import { requirePermission, platformUserId } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, "trade:real");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const channel = process.env.PAYLOR_PAYMENT_CHANNEL || "PAYL-EFSJUF";
  const walletAddress = process.env.PAYLOR_TRON_WALLET || "TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd";

  return NextResponse.json({
    success: true,
    channel,
    walletAddress,
    contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    network: "TRC20",
    asset: "USDT",
    requiredConfirmations: 19,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, "trade:real");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.amount);

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "A valid positive deposit amount in USDT is required." },
        { status: 400 }
      );
    }

    const userId = platformUserId(auth.identity);
    const channel = process.env.PAYLOR_PAYMENT_CHANNEL || "PAYL-EFSJUF";
    const walletAddress = process.env.PAYLOR_TRON_WALLET || "TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd";
    const reference = `PAYLOR_TRC20_${userId.slice(0, 8)}_${Date.now()}`;

    return NextResponse.json({
      success: true,
      depositIntent: {
        reference,
        userId,
        amount,
        asset: "USDT",
        network: "TRC20",
        channel,
        walletAddress,
        contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        instructions:
          "Send exactly the specified USDT amount over the TRON (TRC20) network only. Any other asset or network will not credit.",
        createdAt: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to generate Paylor crypto deposit intent." },
      { status: 500 }
    );
  }
}
