package cryptoworldinvestement.com.core.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface CryptoHubApiService {

    // Auth
    @POST("api/v1/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiResponse<AuthResponse>>

    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<AuthResponse>>

    @GET("api/v1/users/me")
    suspend fun getProfile(): Response<ApiResponse<UserProfile>>

    // Markets
    @GET("api/v1/markets/pairs")
    suspend fun getMarketPairs(): Response<ApiResponse<List<MarketPair>>>

    @GET("api/v1/markets/candles")
    suspend fun getCandlesticks(
        @Query("symbol") symbol: String,
        @Query("timeframe") timeframe: String = "1h",
        @Query("limit") limit: Int = 100
    ): Response<ApiResponse<List<Candlestick>>>

    // Paper Trading
    @POST("api/v1/paper-trading/orders")
    suspend fun createOrder(@Body request: CreateOrderRequest): Response<ApiResponse<OrderResponse>>

    @GET("api/v1/paper-trading/orders")
    suspend fun getOrders(@Query("symbol") symbol: String? = null): Response<ApiResponse<List<OrderResponse>>>

    @POST("api/v1/backtesting/run")
    suspend fun runBacktest(@Body request: BacktestRequest): Response<ApiResponse<BacktestResponse>>

    // Wallet & Ledger
    @GET("api/v1/wallet/summary")
    suspend fun getWalletSummary(): Response<ApiResponse<WalletSummary>>

    @GET("api/v1/wallet/transactions")
    suspend fun getTransactions(): Response<ApiResponse<List<TransactionRecord>>>

    @GET("api/v1/deposits/address")
    suspend fun getDepositAddress(): Response<ApiResponse<DepositAddressResponse>>

    @POST("api/v1/withdrawals/request")
    suspend fun requestWithdrawal(@Body request: WithdrawalRequest): Response<ApiResponse<TransactionRecord>>

    // Rewards & Referral
    @GET("api/v1/rewards/summary")
    suspend fun getRewardsSummary(): Response<ApiResponse<RewardsSummary>>

    // P2P Marketplace
    @GET("api/v1/p2p/ads")
    suspend fun getP2PAds(): Response<ApiResponse<List<P2PAd>>>

    @POST("api/v1/p2p/orders")
    suspend fun createP2POrder(@Body request: CreateP2POrderRequest): Response<ApiResponse<P2POrder>>
}
