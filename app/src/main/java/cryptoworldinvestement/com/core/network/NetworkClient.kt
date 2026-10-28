package cryptoworldinvestement.com.core.network

import cryptoworldinvestement.com.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object NetworkClient {

    // Base URL sourced from build configuration (debug points to local 10.0.2.2:4000, release points to production Vercel)
    private val DEFAULT_BASE_URL = BuildConfig.API_BASE_URL

    fun createApiService(tokenProvider: suspend () -> String?, baseUrl: String = DEFAULT_BASE_URL): CryptoHubApiService {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val authInterceptor = AuthInterceptor(tokenProvider)

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(CryptoHubApiService::class.java)
    }
}
