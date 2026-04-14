package com.beastsaber.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Purple = Color(0xFF6750A4)
private val PurpleLight = Color(0xFFE8DEF8)

private val DarkColors = darkColorScheme(
    primary = PurpleLight,
    secondary = PurpleLight,
    tertiary = PurpleLight
)

private val LightColors = lightColorScheme(
    primary = Purple,
    secondary = Purple,
    tertiary = Purple
)

@Composable
fun BSLinkTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
