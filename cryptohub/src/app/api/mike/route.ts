import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const SYSTEM_PROMPT = `
You are "Mike Trades", the institutional quantitative trading assistant for the CryptoHub platform.
CryptoHub is an institutional-grade cryptocurrency and Forex live trading platform featuring automated quantitative prediction signals, real-time TradingView charts, TRC20 USDT blockchain settlement, and algorithmic risk management.

Key CryptoHub Platform Knowledge:
1. Strictly REAL Live Accounts Only:
   - CryptoHub operates exclusively on live REAL accounts backed by our double-entry USDT ledger. There is no paper or demo trading.
   - All balances equal the exact sum of verified ledger entries (0 drift tolerance).

2. Quantitative Risk Governance:
   - Live accounts trade under a strict quantitative risk framework.
   - Requires a minimum 1:1.5 Reward-to-Risk ratio on all positions.
   - Caps individual trade risk to maximum 2.0% of available capital.
   - Mandatory Stop Loss and Take Profit on all trades.
   - IMPORTANT: Always explain that risk parameters represent a disciplined probabilistic framework, NOT a mathematically guaranteed outcome. Market variance exists, and no trading strategy guarantees profits.

3. TRC20 USDT Deposits & Withdrawals:
   - Deposits: Exclusively USDT on TRON (TRC20) contract TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t via Paylor channel PAYL-EFSJUF to vault TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd (19 block confirmations required).
   - Withdrawals: Server-enforced minimum of $100.00 USDT + $1.00 USDT TRON network gas fee. Reserved atomically on request and reviewed by Admin Authority.

4. Account Levels & Daily Auto-Trade Earnings (Server-Derived):
   - Level 3 (Entry): >= $300.00 cumulative confirmed TRC20 deposits -> $5.00 to $8.00 USDT daily auto-trade earnings.
   - Level 2 (Mid): >= $500.00 cumulative deposits OR Level 3 with > 10 qualified referrals -> $8.00 to $14.00 USDT daily auto-trade earnings.
   - Level 1 (Top): >= $600.00 cumulative deposits OR Level 3 with > 20 qualified referrals -> $10.00 to $18.00 USDT daily auto-trade earnings.
   - Wednesday Bonus: $1.00 USDT credited on Wednesdays (UTC) for eligible accounts (Level 3 and above), once per ISO week.

5. Referral Program:
   - Every verified direct referral earns $30.00 USDT credited directly to the referrer's REAL account ledger.
   - Each referred trader is paid once; self-referral is blocked.
   - Qualified referrals also count toward Level 2 (>10 referrals) and Level 1 (>20 referrals) upgrades.

6. Trading Instruments & Technical Indicators:
   - Cryptocurrencies: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT.
   - Forex pairs: EUR/USD, GBP/USD, USD/JPY with pip-based PnL calculations.
   - Quantitative signals combine RSI, MACD, ADX, Bollinger Bands, ATR, and multi-timeframe EMAs (50/200).
`;

function generateLocalKnowledgeResponse(userQuery: string): string {
  const query = userQuery.toLowerCase();

  if (query.includes("risk model") || query.includes("risk governance") || query.includes("win rate")) {
    return `### The CryptoHub Quantitative Risk Governance Framework

Our proprietary risk-containment framework is designed to maintain disciplined capital preservation over a series of live market setups:

* **Minimum 1:1.5 Reward-to-Risk Ratio:** Every live order must target at least $1.50 in potential profit for every $1.00 risked.
* **Maximum 2.0% Capital Risk:** No single position is permitted to risk more than 2% of total account equity on Stop Loss.
* **Mandatory Stop Loss & Take Profit:** Orders without verified stop losses or take profits are rejected by the risk engine before execution.

⚠️ **Risk Disclosure:** Systematic risk models provide downside containment, not a guarantee. All live trading carries risk of capital loss.`;
  }

  if (query.includes("level") || query.includes("auto-trade") || query.includes("autotrade") || query.includes("tier") || query.includes("wednesday")) {
    return `### Account Levels, Daily Auto-Trade & Wednesday Bonus

Your account tier is **derived automatically on the server** from your cumulative confirmed TRC20 USDT deposits and qualified referrals:

* **Level 3 (Entry Tier):** $\\ge \\$300.00$ USDT cumulative deposit $\\rightarrow$ **$\\$5.00 - \\$8.00$ USDT** daily auto-trade reward.
* **Level 2 (Mid Tier):** $\\ge \\$500.00$ USDT deposit (or Level 3 + $>10$ referrals) $\\rightarrow$ **$\\$8.00 - \\$14.00$ USDT** daily auto-trade reward.
* **Level 1 (Top Tier):** $\\ge \\$600.00$ USDT deposit (or Level 3 + $>20$ referrals) $\\rightarrow$ **$\\$10.00 - \\$18.00$ USDT** daily auto-trade reward.
* **Wednesday Bonus:** Eligible accounts (Level 3 and above) receive an additional **$\\$1.00$ USDT** bonus every Wednesday (UTC).`;
  }

  if (query.includes("deposit") || query.includes("withdraw") || query.includes("trc20") || query.includes("paylor") || query.includes("fund")) {
    return `### Live TRC20 USDT Funding & Withdrawals

CryptoHub operates exclusively on **REAL live capital** settled on the TRON blockchain:

1. **TRC20 USDT Deposits:** Open the **Deposit / Withdraw** modal to generate a Paylor TRC20 deposit intent (\`PAYL-EFSJUF\`) to vault \`TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd\`. Deposits require **19 TRON block confirmations** on contract \`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t\`.
2. **Double-Entry Ledger:** Every confirmed deposit, trade PnL, and reward is recorded in your immutable USDT ledger.
3. **Withdrawals:** Minimum withdrawal is **$\\$100.00$ USDT** (plus $1.00 USDT TRON network gas fee). Funds are atomically reserved upon request and released upon Admin Authority approval.`;
  }

  if (query.includes("referral") || query.includes("invite") || query.includes("earn") || query.includes("bonus") || query.includes("share")) {
    return `### CryptoHub $30.00 USDT Referral Program

Earn live trading capital and unlock higher Auto-Trade tiers by inviting traders:

* **$\\$30.00$ USDT Per Qualified Referral:** Credited directly to your **REAL account balance** via the double-entry ledger.
* **Tier Upgrades:** Having $>10$ qualified referrals promotes a Level 3 account to **Level 2** ($8–$14/day), and $>20$ referrals promotes you to **Level 1** ($10–$18/day).
* **One-Click Sharing:** Copy your unique 6-character code or referral link in the **Referral** tab.`;
  }

  if (query.includes("rsi") || query.includes("macd") || query.includes("indicator") || query.includes("chart") || query.includes("prediction")) {
    return `### Quantitative Signals & Multi-Timeframe Analysis

CryptoHub scores real OHLCV market series across 1m, 5m, 15m, 1H, 4H, and 1D timeframes:

* **RSI (Relative Strength Index):** Measures momentum extremes ($>70$ overbought, $<30$ oversold).
* **MACD & ADX:** Tracks trend direction and directional movement strength.
* **EMA 50 / 200 Alignment:** Identifies Golden Cross and Death Cross macro regimes.
* **1-Click Trade Setup:** Load verified Entry, Stop Loss, and Take Profit levels directly from the **Signals** or **Analysis** tab into your Order Ticket.`;
  }

  if (query.includes("stop loss") || query.includes("take profit") || query.includes("sl") || query.includes("tp")) {
    return `### Mandatory Stop Loss & Take Profit Governance

Every live order on CryptoHub is protected by our server-side Risk Engine:

* **Stop Loss (SL):** Mandatory on every position; caps maximum downside to $\\le 2.0\\%$ of account equity.
* **Take Profit (TP):** Mandatory on every position; must satisfy at least a **1:1.5 Reward-to-Risk ratio** relative to your Stop Loss distance.
* **Risk Presets:** Use the **0.5%**, **1.0%**, or **2.0%** quick-sizing buttons in the Order Ticket to automatically size your position.`;
  }

  return `Hello! I am **Mike Trades**, your institutional quantitative assistant on **CryptoHub**.

I can help you with:
- **Quantitative Risk Governance:** How our mandatory 1:1.5 R:R and 2% max equity risk rules protect live capital.
- **TRC20 USDT Vault & Paylor:** Funding your REAL account and requesting withdrawals ($100.00 USDT minimum).
- **Levels 1–3 & Auto-Trade:** Earning $5–$18 USDT daily + $1.00 Wednesday bonus based on your deposit & referral tier.
- **$30.00 USDT Referrals:** Growing your live balance and promoting your account level.
- **Quantitative Analysis:** Multi-timeframe RSI, MACD, EMA, and walk-forward backtest metrics.

What would you like to analyze today?`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireIdentity(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const messages: ChatMessage[] = body.messages || [];

    if (!messages.length) {
      return NextResponse.json(
        { success: false, error: "Messages array cannot be empty." },
        { status: 400 }
      );
    }

    const latestMessage = messages[messages.length - 1];
    const userQuery = latestMessage?.content || "";

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Question: ${userQuery}` }] },
              ],
            }),
          }
        );
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return NextResponse.json({ success: true, message: reply });
          }
        }
      } catch (err) {
        console.warn("External Gemini API call failed, falling back to local engine:", err);
      }
    }

    if (openaiKey) {
      try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...messages.slice(-6),
            ],
            temperature: 0.6,
            max_tokens: 600,
          }),
        });
        if (openaiRes.ok) {
          const openaiData = await openaiRes.json();
          const reply = openaiData.choices?.[0]?.message?.content;
          if (reply) {
            return NextResponse.json({ success: true, message: reply });
          }
        }
      } catch (err) {
        console.warn("External OpenAI API call failed, falling back to local engine:", err);
      }
    }

    const reply = generateLocalKnowledgeResponse(userQuery);
    return NextResponse.json({ success: true, message: reply });
  } catch (error) {
    console.error("Mike Trades API error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while processing your request." },
      { status: 500 }
    );
  }
}
