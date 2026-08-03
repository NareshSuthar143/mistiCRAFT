package com.misticraft.admin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.misticraft.admin.notification.NotificationHelper
import com.misticraft.admin.ui.navigation.MistiCraftAdminApp
import com.misticraft.admin.ui.theme.MistiCraftAdminTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val highlightAmount = intent
            ?.getDoubleExtra(NotificationHelper.EXTRA_FILTER_AMOUNT, -1.0)
            ?.takeIf { it >= 0 }

        setContent {
            MistiCraftAdminTheme {
                MistiCraftAdminApp(pendingHighlightAmount = highlightAmount)
            }
        }
    }
}
