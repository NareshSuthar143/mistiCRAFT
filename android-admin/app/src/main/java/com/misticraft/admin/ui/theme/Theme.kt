package com.misticraft.admin.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = MistiPrimary,
    primaryContainer = MistiPrimaryContainer,
    secondary = MistiSecondary,
    error = MistiError,
    background = MistiBackground,
    surface = MistiSurface,
    onSurface = MistiOnSurface
)

private val DarkColors = darkColorScheme(
    primary = MistiPrimaryContainer,
    secondary = MistiSecondary,
    error = MistiError
)

@Composable
fun MistiCraftAdminTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(
        colorScheme = colors,
        typography = MistiTypography,
        content = content
    )
}
