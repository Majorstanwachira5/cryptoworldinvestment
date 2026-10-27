package cryptoworldinvestement.com

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.navigation.compose.rememberNavController
import cryptoworldinvestement.com.core.designsystem.CryptoHubTheme
import cryptoworldinvestement.com.core.network.NetworkClient
import cryptoworldinvestement.com.feature.auth.AuthViewModel
import cryptoworldinvestement.com.navigation.AppNavigation
import kotlinx.coroutines.flow.firstOrNull

class MainActivity : ComponentActivity() {

    private val mainViewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val apiService = NetworkClient.createApiService(
            tokenProvider = { mainViewModel.sessionManager.accessTokenFlow.firstOrNull() }
        )

        val authViewModel = AuthViewModel(
            apiService = apiService,
            sessionManager = mainViewModel.sessionManager
        )

        setContent {
            CryptoHubTheme {
                val navController = rememberNavController()
                AppNavigation(
                    navController = navController,
                    mainViewModel = mainViewModel,
                    authViewModel = authViewModel
                )
            }
        }
    }
}
