package com.misticraft.admin.ui.screens.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.misticraft.admin.ui.navigation.Screen

@Composable
fun MoreScreen(onNavigate: (String) -> Unit, onSignOut: () -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text("More") }) }) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            ListItem(
                headlineContent = { Text("Artisans") },
                leadingContent = { Icon(Icons.Filled.Groups, contentDescription = null) },
                trailingContent = { Icon(Icons.Filled.ChevronRight, contentDescription = null) },
                modifier = Modifier.clickable { onNavigate(Screen.Artisans.route) }
            )
            ListItem(
                headlineContent = { Text("Leadership") },
                leadingContent = { Icon(Icons.Filled.Storefront, contentDescription = null) },
                trailingContent = { Icon(Icons.Filled.ChevronRight, contentDescription = null) },
                modifier = Modifier.clickable { onNavigate(Screen.Founders.route) }
            )
            ListItem(
                headlineContent = { Text("Payment Alerts") },
                supportingContent = { Text("Google Pay notification access, auto-accept") },
                leadingContent = { Icon(Icons.Filled.NotificationsActive, contentDescription = null) },
                trailingContent = { Icon(Icons.Filled.ChevronRight, contentDescription = null) },
                modifier = Modifier.clickable { onNavigate(Screen.NotificationAccess.route) }
            )
            ListItem(
                headlineContent = { Text("Store Settings") },
                leadingContent = { Icon(Icons.Filled.Settings, contentDescription = null) },
                trailingContent = { Icon(Icons.Filled.ChevronRight, contentDescription = null) },
                modifier = Modifier.clickable { onNavigate(Screen.Settings.route) }
            )
            ListItem(
                headlineContent = { Text("Sign Out") },
                leadingContent = { Icon(Icons.Filled.Logout, contentDescription = null) },
                modifier = Modifier.clickable { onSignOut() }
            )
        }
    }
}
