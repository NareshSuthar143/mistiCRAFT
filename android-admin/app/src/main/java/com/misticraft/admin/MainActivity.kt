package com.misticraft.admin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.misticraft.admin.notification.NotificationHelper
import com.misticraft.admin.ui.CrashScreen
import com.misticraft.admin.ui.navigation.MistiCraftAdminApp
import com.misticraft.admin.ui.theme.MistiCraftAdminTheme
import com.misticraft.admin.util.CrashLogger

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val highlightAmount = intent
            ?.getDoubleExtra(NotificationHelper.EXTRA_FILTER_AMOUNT, -1.0)
            ?.takeIf { it >= 0 }
        val lastCrash = CrashLogger.readLastCrash(this)

        setContent {
            MistiCraftAdminTheme {
                var crash by remember { mutableStateOf(lastCrash) }
                if (crash != null) {
                    CrashScreen(
                        stackTrace = crash.orEmpty(),
                        onDismiss = {
                            CrashLogger.clear(this@MainActivity)
                            crash = null
                        }
                    )
                } else {
                    MistiCraftAdminApp(pendingHighlightAmount = highlightAmount)
                }
            }
        }
    }
}
