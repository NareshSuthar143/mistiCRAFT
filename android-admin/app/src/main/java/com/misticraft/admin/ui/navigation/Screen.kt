package com.misticraft.admin.ui.navigation

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Orders : Screen("orders")
    object Products : Screen("products")
    object ProductEdit : Screen("product_edit?id={id}") {
        fun route(id: String? = null) = "product_edit?id=${id ?: ""}"
    }
    object Artisans : Screen("artisans")
    object ArtisanEdit : Screen("artisan_edit?id={id}") {
        fun route(id: String? = null) = "artisan_edit?id=${id ?: ""}"
    }
    object Founders : Screen("founders")
    object FounderEdit : Screen("founder_edit?id={id}") {
        fun route(id: String? = null) = "founder_edit?id=${id ?: ""}"
    }
    object Settings : Screen("settings")
    object NotificationAccess : Screen("notification_access")
    object More : Screen("more")
}
