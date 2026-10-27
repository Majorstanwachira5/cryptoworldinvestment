package cryptoworldinvestement.com.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cryptoworldinvestement.com.core.network.AuthResponse
import cryptoworldinvestement.com.core.network.CryptoHubApiService
import cryptoworldinvestement.com.core.network.LoginRequest
import cryptoworldinvestement.com.core.network.RegisterRequest
import cryptoworldinvestement.com.core.security.SessionManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AuthUiState {
    object Idle : AuthUiState
    object Loading : AuthUiState
    data class Success(val response: AuthResponse) : AuthUiState
    data class Error(val message: String) : AuthUiState
}

class AuthViewModel(
    private val apiService: CryptoHubApiService,
    private val sessionManager: SessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.value = AuthUiState.Error("Please enter email and password.")
            return
        }

        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                val res = apiService.login(LoginRequest(email, password))
                if (res.isSuccessful && res.body()?.success == true && res.body()?.data != null) {
                    val authData = res.body()!!.data!!
                    sessionManager.saveSession(
                        userId = authData.userId,
                        email = authData.email,
                        fullName = authData.fullName,
                        referralCode = authData.referralCode,
                        accessToken = authData.accessToken,
                        refreshToken = authData.refreshToken
                    )
                    _uiState.value = AuthUiState.Success(authData)
                } else {
                    _uiState.value = AuthUiState.Error(res.body()?.message ?: "Login failed. Please check credentials.")
                }
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error("Network error: ${e.localizedMessage}")
            }
        }
    }

    fun register(fullName: String, email: String, password: String, referralCode: String) {
        if (fullName.isBlank() || email.isBlank() || password.isBlank()) {
            _uiState.value = AuthUiState.Error("Please fill in all required fields.")
            return
        }

        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                val req = RegisterRequest(
                    email = email,
                    password = password,
                    fullName = fullName,
                    referralCode = if (referralCode.isBlank()) null else referralCode
                )
                val res = apiService.register(req)
                if (res.isSuccessful && res.body()?.success == true && res.body()?.data != null) {
                    val authData = res.body()!!.data!!
                    sessionManager.saveSession(
                        userId = authData.userId,
                        email = authData.email,
                        fullName = authData.fullName,
                        referralCode = authData.referralCode,
                        accessToken = authData.accessToken,
                        refreshToken = authData.refreshToken
                    )
                    _uiState.value = AuthUiState.Success(authData)
                } else {
                    _uiState.value = AuthUiState.Error(res.body()?.message ?: "Registration failed.")
                }
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error("Network error: ${e.localizedMessage}")
            }
        }
    }

    fun resetState() {
        _uiState.value = AuthUiState.Idle
    }
}
