package com.misticraft.admin

import android.app.Application
import com.misticraft.admin.notification.NotificationHelper
import com.misticraft.admin.util.CrashLogger

class MistiCraftApp : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashLogger.install(this)
        NotificationHelper.ensureChannels(this)
    }
}
