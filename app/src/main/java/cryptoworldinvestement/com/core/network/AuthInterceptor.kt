package cryptoworldinvestement.com.core.network

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(
    private val tokenProvider: suspend () -> String?
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = runBlocking { tokenProvider() }

        val requestBuilder = original.newBuilder()
        if (!token.isNull_or_empty_or_blank(token)) {
            requestBuilder.header("Authorization", "Bearer $token")
        }

        return chain.proceed(requestBuilder.build())
    }

    private fun isNull_or_empty_or_blank(str: String?): Boolean {
        return str.isNullOrBlank()
    }
}
