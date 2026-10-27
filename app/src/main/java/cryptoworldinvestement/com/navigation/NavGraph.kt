package cryptoworldinvestement.com.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.*
import cryptoworldinvestement.com.MainViewModel
import cryptoworldinvestement.com.core.designsystem.*
import cryptoworldinvestement.com.feature.auth.AuthViewModel
import cryptoworldinvestement.com.feature.auth.LoginScreen
import cryptoworldinvestement.com.feature.auth.RegisterScreen
import cryptoworldinvestement.com.feature.home.HomeScreen
import cryptoworldinvestement.com.feature.markets.MarketDetailScreen
import cryptoworldinvestement.com.feature.markets.MarketsScreen
import cryptoworldinvestement.com.feature.p2p.P2PScreen
import cryptoworldinvestement.com.feature.profile.ProfileScreen
import cryptoworldinvestement.com.feature.rewards.RewardsScreen
import cryptoworldinvestement.com.feature.trading.BacktestingScreen
import cryptoworldinvestement.com.feature.trading.TradingScreen
import cryptoworldinvestement.com.feature.wallet.DepositScreen
import cryptoworldinvestement.com.feature.wallet.WalletScreen
import cryptoworldinvestement.com.feature.wallet.WithdrawalScreen

sealed class BottomNavItem(val route: String, val title: String, val icon: ImageVector) {
    object Home : BottomNavItem("home", "Home", Icons.Default.Home)
    object Markets : BottomNavItem("markets", "Markets", Icons.Default.ShowChart)
    object Trade : BottomNavItem("trade/BTC-USDT", "Trade", Icons.Default.SwapHoriz)
    object Assets : BottomNavItem("wallet", "Assets", Icons.Default.AccountBalanceWallet)
    object Profile : BottomNavItem("profile", "Profile", Icons.Default.Person)
}

@Composable
fun AppNavigation(
    navController: NavHostController,
    mainViewModel: MainViewModel,
    authViewModel: AuthViewModel
) {
    val isLoggedIn by mainViewModel.isLoggedIn.collectAsState()
    val walletSummary by mainViewModel.walletSummary.collectAsState()
    val marketPairs by mainViewModel.marketPairs.collectAsState()
    val candlesticks by mainViewModel.candlesticks.collectAsState()
    val orders by mainViewModel.orders.collectAsState()
    val backtestResult by mainViewModel.backtestResult.collectAsState()
    val transactions by mainViewModel.transactions.collectAsState()
    val depositInfo by mainViewModel.depositInfo.collectAsState()
    val rewardsSummary by mainViewModel.rewardsSummary.collectAsState()
    val p2pAds by mainViewModel.p2pAds.collectAsState()
    val userProfile by mainViewModel.userProfile.collectAsState()

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val bottomItems = listOf(
        BottomNavItem.Home,
        BottomNavItem.Markets,
        BottomNavItem.Trade,
        BottomNavItem.Assets,
        BottomNavItem.Profile
    )

    Scaffold(
        bottomBar = {
            if (isLoggedIn && currentRoute != "auth_login" && currentRoute != "auth_register") {
                NavigationBar(
                    containerColor = DarkSurface,
                    contentColor = TextPrimary
                ) {
                    bottomItems.forEach { item ->
                        val selected = currentRoute?.startsWith(item.route.split("/")[0]) == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = item.title) },
                            label = { Text(item.title) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = AccentGold,
                                selectedTextColor = AccentGold,
                                unselectedIconColor = TextSecondary,
                                unselectedTextColor = TextSecondary,
                                indicatorColor = DarkSurfaceVariant
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = if (isLoggedIn) "home" else "auth_login",
            modifier = Modifier.padding(innerPadding)
        ) {
            composable("auth_login") {
                LoginScreen(
                    viewModel = authViewModel,
                    onNavigateToRegister = { navController.navigate("auth_register") },
                    onLoginSuccess = {
                        mainViewModel.checkSession()
                        navController.navigate("home") {
                            popUpTo("auth_login") { inclusive = true }
                        }
                    }
                )
            }

            composable("auth_register") {
                RegisterScreen(
                    viewModel = authViewModel,
                    onNavigateToLogin = { navController.navigate("auth_login") },
                    onRegisterSuccess = {
                        mainViewModel.checkSession()
                        navController.navigate("home") {
                            popUpTo("auth_register") { inclusive = true }
                        }
                    }
                )
            }

            composable("home") {
                HomeScreen(
                    walletSummary = walletSummary,
                    marketPairs = marketPairs,
                    onNavigateToTrade = { symbol -> navController.navigate("trade/${symbol.replace("/", "-")}") },
                    onNavigateToDeposit = { navController.navigate("deposit") },
                    onNavigateToRewards = { navController.navigate("rewards") }
                )
            }

            composable("markets") {
                MarketsScreen(
                    pairs = marketPairs,
                    onSelectPair = { symbol -> navController.navigate("market_detail/${symbol.replace("/", "-")}") }
                )
            }

            composable("market_detail/{symbol}") { backStackEntry ->
                val rawSymbol = backStackEntry.arguments?.getString("symbol") ?: "BTC-USDT"
                val symbol = rawSymbol.replace("-", "/")
                val pair = marketPairs.find { it.symbol == symbol }

                LaunchedEffect(symbol) {
                    mainViewModel.loadCandlesticks(symbol)
                }

                MarketDetailScreen(
                    pair = pair,
                    candles = candlesticks,
                    onNavigateToTrade = { sym -> navController.navigate("trade/${sym.replace("/", "-")}") }
                )
            }

            composable("trade/{symbol}") { backStackEntry ->
                val rawSymbol = backStackEntry.arguments?.getString("symbol") ?: "BTC-USDT"
                val symbol = rawSymbol.replace("-", "/")

                LaunchedEffect(symbol) {
                    mainViewModel.loadOrders(symbol)
                }

                TradingScreen(
                    symbol = symbol,
                    orders = orders,
                    onPlaceOrder = { sym, type, side, amount, price ->
                        mainViewModel.placeOrder(sym, type, side, amount, price)
                    }
                )
            }

            composable("backtesting") {
                BacktestingScreen(
                    result = backtestResult,
                    onRunBacktest = { strat, sym, cap -> mainViewModel.runBacktest(strat, sym, cap) }
                )
            }

            composable("wallet") {
                WalletScreen(
                    summary = walletSummary,
                    transactions = transactions,
                    onNavigateToDeposit = { navController.navigate("deposit") },
                    onNavigateToWithdrawal = { navController.navigate("withdrawal") }
                )
            }

            composable("deposit") {
                LaunchedEffect(Unit) {
                    mainViewModel.loadDepositAddress()
                }
                DepositScreen(depositInfo = depositInfo)
            }

            composable("withdrawal") {
                WithdrawalScreen(
                    availableBalance = walletSummary?.availableBalance ?: 0.0,
                    onRequestWithdrawal = { addr, amt ->
                        mainViewModel.requestWithdrawal(addr, amt)
                        navController.navigate("wallet")
                    }
                )
            }

            composable("rewards") {
                RewardsScreen(summary = rewardsSummary)
            }

            composable("p2p") {
                P2PScreen(
                    ads = p2pAds,
                    onCreateOrder = { adId, amt -> mainViewModel.createP2POrder(adId, amt) }
                )
            }

            composable("profile") {
                ProfileScreen(
                    userProfile = userProfile,
                    onLogout = {
                        mainViewModel.logout()
                        navController.navigate("auth_login") {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
        }
    }
}
