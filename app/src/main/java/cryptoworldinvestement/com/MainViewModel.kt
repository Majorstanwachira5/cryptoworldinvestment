package cryptoworldinvestement.com

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import cryptoworldinvestement.com.core.database.CachedMarketPairEntity
import cryptoworldinvestement.com.core.database.CryptoHubDatabase
import cryptoworldinvestement.com.core.network.*
import cryptoworldinvestement.com.core.security.SessionManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch

class MainViewModel(application: Application) : AndroidViewModel(application) {

    val sessionManager = SessionManager(application)
    private val database = CryptoHubDatabase.getDatabase(application)
    private val marketPairDao = database.marketPairDao()

    private val apiService: CryptoHubApiService = NetworkClient.createApiService(
        tokenProvider = { sessionManager.accessTokenFlow.firstOrNull() }
    )

    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _walletSummary = MutableStateFlow<WalletSummary?>(null)
    val walletSummary: StateFlow<WalletSummary?> = _walletSummary.asStateFlow()

    private val _marketPairs = MutableStateFlow<List<MarketPair>>(emptyList())
    val marketPairs: StateFlow<List<MarketPair>> = _marketPairs.asStateFlow()

    private val _candlesticks = MutableStateFlow<List<Candlestick>>(emptyList())
    val candlesticks: StateFlow<List<Candlestick>> = _candlesticks.asStateFlow()

    private val _orders = MutableStateFlow<List<OrderResponse>>(emptyList())
    val orders: StateFlow<List<OrderResponse>> = _orders.asStateFlow()

    private val _backtestResult = MutableStateFlow<BacktestResponse?>(null)
    val backtestResult: StateFlow<BacktestResponse?> = _backtestResult.asStateFlow()

    private val _transactions = MutableStateFlow<List<TransactionRecord>>(emptyList())
    val transactions: StateFlow<List<TransactionRecord>> = _transactions.asStateFlow()

    private val _depositInfo = MutableStateFlow<DepositAddressResponse?>(null)
    val depositInfo: StateFlow<DepositAddressResponse?> = _depositInfo.asStateFlow()

    private val _rewardsSummary = MutableStateFlow<RewardsSummary?>(null)
    val rewardsSummary: StateFlow<RewardsSummary?> = _rewardsSummary.asStateFlow()

    private val _p2pAds = MutableStateFlow<List<P2PAd>>(emptyList())
    val p2pAds: StateFlow<List<P2PAd>> = _p2pAds.asStateFlow()

    private val _userProfile = MutableStateFlow<UserProfile?>(null)
    val userProfile: StateFlow<UserProfile?> = _userProfile.asStateFlow()

    init {
        checkSession()
    }

    fun checkSession() {
        viewModelScope.launch {
            val token = sessionManager.accessTokenFlow.firstOrNull()
            _isLoggedIn.value = !token.isNullOrBlank()
            if (_isLoggedIn.value) {
                loadInitialData()
            }
        }
    }

    fun loadInitialData() {
        viewModelScope.launch {
            loadMarketPairs()
            loadWalletSummary()
            loadTransactions()
            loadRewardsSummary()
            loadP2PAds()
            loadUserProfile()
        }
    }

    fun loadMarketPairs() {
        viewModelScope.launch {
            try {
                val res = apiService.getMarketPairs()
                if (res.isSuccessful && res.body()?.success == true && res.body()?.data != null) {
                    val pairs = res.body()!!.data!!
                    _marketPairs.value = pairs

                    // Cache in Room
                    val entities = pairs.map {
                        CachedMarketPairEntity(
                            symbol = it.symbol,
                            baseAsset = it.baseAsset,
                            quoteAsset = it.quoteAsset,
                            lastPrice = it.lastPrice,
                            change24h = it.change24h,
                            high24h = it.high24h,
                            low24h = it.low24h,
                            volume24h = it.volume24h
                        )
                    }
                    marketPairDao.insertAll(entities)
                } else {
                    // Fallback to local Room cache
                    val cached = marketPairDao.getAllPairs().map {
                        MarketPair(
                            symbol = it.symbol,
                            baseAsset = it.baseAsset,
                            quoteAsset = it.quoteAsset,
                            lastPrice = it.lastPrice,
                            change24h = it.change24h,
                            high24h = it.high24h,
                            low24h = it.low24h,
                            volume24h = it.volume24h
                        )
                    }
                    if (cached.isNotEmpty()) _marketPairs.value = cached
                }
            } catch (e: Exception) {
                // Fallback to local Room cache
                val cached = marketPairDao.getAllPairs().map {
                    MarketPair(
                        symbol = it.symbol,
                        baseAsset = it.baseAsset,
                        quoteAsset = it.quoteAsset,
                        lastPrice = it.lastPrice,
                        change24h = it.change24h,
                        high24h = it.high24h,
                        low24h = it.low24h,
                        volume24h = it.volume24h
                    )
                }
                if (cached.isNotEmpty()) _marketPairs.value = cached
            }
        }
    }

    fun loadWalletSummary() {
        viewModelScope.launch {
            try {
                val res = apiService.getWalletSummary()
                if (res.isSuccessful && res.body()?.data != null) {
                    _walletSummary.value = res.body()!!.data
                }
            } catch (_: Exception) {}
        }
    }

    fun loadCandlesticks(symbol: String) {
        viewModelScope.launch {
            try {
                val res = apiService.getCandlesticks(symbol)
                if (res.isSuccessful && res.body()?.data != null) {
                    _candlesticks.value = res.body()!!.data!!
                }
            } catch (_: Exception) {}
        }
    }

    fun loadOrders(symbol: String) {
        viewModelScope.launch {
            try {
                val res = apiService.getOrders(symbol)
                if (res.isSuccessful && res.body()?.data != null) {
                    _orders.value = res.body()!!.data!!
                }
            } catch (_: Exception) {}
        }
    }

    fun placeOrder(symbol: String, type: String, side: String, amount: Double, price: Double?) {
        viewModelScope.launch {
            try {
                val req = CreateOrderRequest(symbol, type, side, amount, price)
                val res = apiService.createOrder(req)
                if (res.isSuccessful && res.body()?.success == true) {
                    loadOrders(symbol)
                    loadWalletSummary()
                }
            } catch (_: Exception) {}
        }
    }

    fun runBacktest(strategy: String, symbol: String, capital: Double) {
        viewModelScope.launch {
            try {
                val req = BacktestRequest(strategy, symbol, capital, "1h", 30)
                val res = apiService.runBacktest(req)
                if (res.isSuccessful && res.body()?.data != null) {
                    _backtestResult.value = res.body()!!.data
                }
            } catch (_: Exception) {}
        }
    }

    fun loadTransactions() {
        viewModelScope.launch {
            try {
                val res = apiService.getTransactions()
                if (res.isSuccessful && res.body()?.data != null) {
                    _transactions.value = res.body()!!.data!!
                }
            } catch (_: Exception) {}
        }
    }

    fun loadDepositAddress() {
        viewModelScope.launch {
            try {
                val res = apiService.getDepositAddress()
                if (res.isSuccessful && res.body()?.data != null) {
                    _depositInfo.value = res.body()!!.data
                }
            } catch (_: Exception) {}
        }
    }

    fun requestWithdrawal(address: String, amount: Double) {
        viewModelScope.launch {
            try {
                val res = apiService.requestWithdrawal(WithdrawalRequest(address, "TRC20", amount))
                if (res.isSuccessful) {
                    loadWalletSummary()
                    loadTransactions()
                }
            } catch (_: Exception) {}
        }
    }

    fun loadRewardsSummary() {
        viewModelScope.launch {
            try {
                val res = apiService.getRewardsSummary()
                if (res.isSuccessful && res.body()?.data != null) {
                    _rewardsSummary.value = res.body()!!.data
                }
            } catch (_: Exception) {}
        }
    }

    fun loadP2PAds() {
        viewModelScope.launch {
            try {
                val res = apiService.getP2PAds()
                if (res.isSuccessful && res.body()?.data != null) {
                    _p2pAds.value = res.body()!!.data!!
                }
            } catch (_: Exception) {}
        }
    }

    fun createP2POrder(adId: String, amount: Double) {
        viewModelScope.launch {
            try {
                apiService.createP2POrder(CreateP2POrderRequest(adId, amount))
                loadWalletSummary()
            } catch (_: Exception) {}
        }
    }

    fun loadUserProfile() {
        viewModelScope.launch {
            try {
                val res = apiService.getProfile()
                if (res.isSuccessful && res.body()?.data != null) {
                    _userProfile.value = res.body()!!.data
                }
            } catch (_: Exception) {}
        }
    }

    fun logout() {
        viewModelScope.launch {
            sessionManager.clearSession()
            _isLoggedIn.value = false
            _walletSummary.value = null
            _userProfile.value = null
        }
    }
}
