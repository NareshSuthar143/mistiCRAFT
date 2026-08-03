package com.misticraft.admin

import android.app.Application
import com.misticraft.admin.notification.NotificationHelper

class MistiCraftApp : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationHelper.ensureChannels(this)
    }
}
