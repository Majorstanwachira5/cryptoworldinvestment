package cryptoworldinvestement.com.core.network

import com.google.gson.annotations.SerializedName

// Common API Response wrapper
data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: T? = null,
    @SerializedName("message") val message: String? = null
)

// Auth DTOs
data class RegisterRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("fullName") val fullName: String,
    @SerializedName("referralCode") val referralCode: String? = null
)

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class AuthResponse(
    @SerializedName("userId") val userId: String,
    @SerializedName("email") val email: String,
    @SerializedName("fullName") val fullName: String,
    @SerializedName("referralCode") val referralCode: String,
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String
)

data class UserProfile(
    @SerializedName("userId") val userId: String,
    @SerializedName("email") val email: String,
    @SerializedName("fullName") val fullName: String,
    @SerializedName("kycStatus") val kycStatus: String,
    @SerializedName("referralCode") val referralCode: String,
    @SerializedName("mfaEnabled") val mfaEnabled: Boolean,
    @SerializedName("createdAt") val createdAt: String
)

// Market DTOs
data class MarketPair(
    @SerializedName("symbol") val symbol: String,
    @SerializedName("baseAsset") val baseAsset: String,
    @SerializedName("quoteAsset") val quoteAsset: String,
    @SerializedName("lastPrice") val lastPrice: Double,
    @SerializedName("change24h") val change24h: Double,
    @SerializedName("high24h") val high24h: Double,
    @SerializedName("low24h") val low24h: Double,
    @SerializedName("volume24h") val volume24h: Double
)

data class Candlestick(
    @SerializedName("timestamp") val timestamp: Long,
    @SerializedName("open") val open: Double,
    @SerializedName("high") val high: Double,
    @SerializedName("low") val low: Double,
    @SerializedName("close") val close: Double,
    @SerializedName("volume") val volume: Double
)

// Trading & Paper Trading DTOs
data class CreateOrderRequest(
    @SerializedName("symbol") val symbol: String,
    @SerializedName("type") val type: String, // "MARKET" or "LIMIT"
    @SerializedName("side") val side: String, // "BUY" or "SELL"
    @SerializedName("amount") val amount: Double,
    @SerializedName("price") val price: Double? = null
)

data class OrderResponse(
    @SerializedName("orderId") val orderId: String,
    @SerializedName("userId") val userId: String,
    @SerializedName("symbol") val symbol: String,
    @SerializedName("type") val type: String,
    @SerializedName("side") val side: String,
    @SerializedName("price") val price: Double,
    @SerializedName("amount") val amount: Double,
    @SerializedName("filledAmount") val filledAmount: Double,
    @SerializedName("status") val status: String, // "OPEN", "FILLED", "CANCELLED"
    @SerializedName("createdAt") val createdAt: String
)

data class BacktestRequest(
    @SerializedName("strategy") val strategy: String, // "SMA_CROSS", "RSI_REVERSAL"
    @SerializedName("symbol") val symbol: String,
    @SerializedName("initialCapital") val initialCapital: Double,
    @SerializedName("timeframe") val timeframe: String,
    @SerializedName("days") val days: Int
)

data class BacktestResponse(
    @SerializedName("totalReturnPercent") val totalReturnPercent: Double,
    @SerializedName("winRatePercent") val winRatePercent: Double,
    @SerializedName("maxDrawdownPercent") val maxDrawdownPercent: Double,
    @SerializedName("totalTrades") val totalTrades: Int,
    @SerializedName("profitFactor") val profitFactor: Double,
    @SerializedName("equityCurve") val equityCurve: List<Double>
)

// Wallet & Ledger DTOs
data class WalletSummary(
    @SerializedName("totalBalance") val totalBalance: Double,
    @SerializedName("availableBalance") val availableBalance: Double,
    @SerializedName("reservedBalance") val reservedBalance: Double,
    @SerializedName("asset") val asset: String = "USDT"
)

data class TransactionRecord(
    @SerializedName("transactionId") val transactionId: String,
    @SerializedName("type") val type: String, // "DEPOSIT", "WITHDRAWAL", "TRADE", "REFERRAL_REWARD"
    @SerializedName("amount") val amount: Double,
    @SerializedName("status") val status: String, // "PENDING", "CREDITED", "FAILED", "REVERSED"
    @SerializedName("reference") val reference: String,
    @SerializedName("timestamp") val timestamp: String
)

data class DepositAddressResponse(
    @SerializedName("network") val network: String = "TRC20",
    @SerializedName("address") val address: String,
    @SerializedName("qrCodeUri") val qrCodeUri: String
)

data class WithdrawalRequest(
    @SerializedName("address") val address: String,
    @SerializedName("network") val network: String = "TRC20",
    @SerializedName("amount") val amount: Double
)

// Rewards & Referral DTOs
data class RewardsSummary(
    @SerializedName("referralCode") val referralCode: String,
    @SerializedName("totalEarned") val totalEarned: Double,
    @SerializedName("level1ReferralsCount") val level1ReferralsCount: Int,
    @SerializedName("level2ReferralsCount") val level2ReferralsCount: Int,
    @SerializedName("pendingRewards") val pendingRewards: Double,
    @SerializedName("rewardHistory") val rewardHistory: List<TransactionRecord>
)

// P2P DTOs
data class P2PAd(
    @SerializedName("adId") val adId: String,
    @SerializedName("merchantName") val merchantName: String,
    @SerializedName("type") val type: String, // "BUY" or "SELL"
    @SerializedName("price") val price: Double,
    @SerializedName("fiatCurrency") val fiatCurrency: String,
    @SerializedName("availableAmount") val availableAmount: Double,
    @SerializedName("minLimit") val minLimit: Double,
    @SerializedName("maxLimit") val maxLimit: Double,
    @SerializedName("paymentMethods") val paymentMethods: List<String>
)

data class CreateP2POrderRequest(
    @SerializedName("adId") val adId: String,
    @SerializedName("amount") val amount: Double
)

data class P2POrder(
    @SerializedName("orderId") val orderId: String,
    @SerializedName("adId") val adId: String,
    @SerializedName("buyerName") val buyerName: String,
    @SerializedName("sellerName") val sellerName: String,
    @SerializedName("amountUsdt") val amountUsdt: Double,
    @SerializedName("fiatAmount") val fiatAmount: Double,
    @SerializedName("status") val status: String, // "PENDING", "PAID", "COMPLETED", "DISPUTED"
    @SerializedName("createdAt") val createdAt: String
)
