package com.beastsaber.app.data.network

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object NetworkModule {

    private const val BASE_URL = "https://api.beatsaver.com/"

    private val logging: HttpLoggingInterceptor =
        HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }

    /** BeatSaver sometimes rate-limits or behaves differently for generic OkHttp UAs; match a normal API client. */
    private val apiHeaders: Interceptor = Interceptor { chain ->
        val req = chain.request()
        chain.proceed(
            req.newBuilder()
                .header("User-Agent", "BSLink/1.0 (BeatSaver Android)")
                .header("Accept", "application/json")
                .build()
        )
    }

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .addInterceptor(apiHeaders)
        .addInterceptor(logging)
        .build()

    val api: BeatSaverApi = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(client)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(BeatSaverApi::class.java)
}
