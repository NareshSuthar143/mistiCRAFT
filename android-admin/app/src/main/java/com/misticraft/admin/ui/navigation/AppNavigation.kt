package com.misticraft.admin.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.misticraft.admin.ui.SessionState
import com.misticraft.admin.ui.SessionViewModel
import com.misticraft.admin.ui.screens.artisans.ArtisanEditScreen
import com.misticraft.admin.ui.screens.artisans.ArtisansScreen
import com.misticraft.admin.ui.screens.founders.FounderEditScreen
import com.misticraft.admin.ui.screens.founders.FoundersScreen
import com.misticraft.admin.ui.screens.login.LoginScreen
import com.misticraft.admin.ui.screens.notifaccess.NotificationAccessScreen
import com.misticraft.admin.ui.screens.orders.OrdersScreen
import com.misticraft.admin.ui.screens.products.ProductEditScreen
import com.misticraft.admin.ui.screens.products.ProductsScreen
import com.misticraft.admin.ui.screens.settings.MoreScreen
import com.misticraft.admin.ui.screens.settings.SettingsScreen

private data class BottomDestination(val screen: Screen, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val bottomDestinations = listOf(
    BottomDestination(Screen.Orders, "Orders", Icons.Filled.LocalShipping),
    BottomDestination(Screen.Products, "Products", Icons.Filled.Storefront),
    BottomDestination(Screen.More, "More", Icons.Filled.MoreHoriz)
)

@Composable
fun MistiCraftAdminApp(pendingHighlightAmount: Double?) {
    val sessionViewModel: SessionViewModel = viewModel()
    val sessionState by sessionViewModel.state.collectAsState()

    when (sessionState) {
        SessionState.LOADING -> LoadingScreen()
        SessionState.LOGGED_OUT -> LoginScreen(onLoginSuccess = { sessionViewModel.refresh() })
        SessionState.LOGGED_IN_NOT_ADMIN -> NotAdminScreen(onSignOut = { sessionViewModel.signOut() })
        SessionState.LOGGED_IN_ADMIN -> MainAppScaffold(
            pendingHighlightAmount = pendingHighlightAmount,
            onSignOut = { sessionViewModel.signOut() }
        )
    }
}

@Composable
private fun LoadingScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

@Composable
private fun NotAdminScreen(onSignOut: () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("This account isn't on the admin allowlist.")
            Spacer(Modifier.height(12.dp))
            Text("Ask an existing admin to add you in the `admins` table, or sign in with a different account.")
            Spacer(Modifier.height(16.dp))
            androidx.compose.material3.TextButton(onClick = onSignOut) { Text("Sign out") }
        }
    }
}

@Composable
private fun MainAppScaffold(pendingHighlightAmount: Double?, onSignOut: () -> Unit) {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            NavigationBar {
                val backStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = backStackEntry?.destination
                bottomDestinations.forEach { dest ->
                    NavigationBarItem(
                        selected = currentRoute?.hierarchy?.any { it.route == dest.screen.route } == true,
                        onClick = {
                            navController.navigate(dest.screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(dest.icon, contentDescription = dest.label) },
                        label = { Text(dest.label) }
                    )
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Orders.route,
            modifier = Modifier.padding(padding)
        ) {
            composable(Screen.Orders.route) {
                OrdersScreen(initialHighlightAmount = pendingHighlightAmount)
            }
            composable(Screen.Products.route) {
                ProductsScreen(onEdit = { id -> navController.navigate(Screen.ProductEdit.route(id)) })
            }
            composable(Screen.ProductEdit.route) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id")?.takeIf { it.isNotBlank() }
                ProductEditScreen(productId = id, onDone = { navController.popBackStack() })
            }
            composable(Screen.Artisans.route) {
                ArtisansScreen(onEdit = { id -> navController.navigate(Screen.ArtisanEdit.route(id)) })
            }
            composable(Screen.ArtisanEdit.route) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id")?.takeIf { it.isNotBlank() }
                ArtisanEditScreen(artisanId = id, onDone = { navController.popBackStack() })
            }
            composable(Screen.Founders.route) {
                FoundersScreen(onEdit = { id -> navController.navigate(Screen.FounderEdit.route(id)) })
            }
            composable(Screen.FounderEdit.route) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id")?.takeIf { it.isNotBlank() }
                FounderEditScreen(founderId = id, onDone = { navController.popBackStack() })
            }
            composable(Screen.Settings.route) { SettingsScreen() }
            composable(Screen.NotificationAccess.route) { NotificationAccessScreen() }
            composable(Screen.More.route) {
                MoreScreen(
                    onNavigate = { navController.navigate(it) },
                    onSignOut = onSignOut
                )
            }
        }
    }
}
