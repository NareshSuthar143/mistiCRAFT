package com.misticraft.admin.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.misticraft.admin.MainActivity
import com.misticraft.admin.R

object NotificationHelper {
    const val CHANNEL_AUTO_ACCEPT = "mc_auto_accept"
    const val CHANNEL_NEEDS_CONFIRMATION = "mc_needs_confirmation"
    const val EXTRA_FILTER_AMOUNT = "filter_amount"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_AUTO_ACCEPT,
                "Auto-accepted orders",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply { description = "Confirmation when a payment notification auto-accepted an order" }
        )
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_NEEDS_CONFIRMATION,
                "Needs confirmation",
                NotificationManager.IMPORTANCE_HIGH
            ).apply { description = "A payment was detected but matched more than one pending order" }
        )
    }

    fun notifyAutoAccepted(context: Context, orderNumber: String, amountLabel: String) {
        ensureChannels(context)
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, orderNumber.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_AUTO_ACCEPT)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Order $orderNumber auto-accepted")
            .setContentText("$amountLabel payment matched and moved to Processing")
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
        context.getSystemService(NotificationManager::class.java)
            .notify(orderNumber.hashCode(), notification)
    }

    fun notifyNeedsConfirmation(context: Context, amount: Double, candidateCount: Int) {
        ensureChannels(context)
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_FILTER_AMOUNT, amount)
        }
        val pendingIntent = PendingIntent.getActivity(
            context, ("confirm-$amount").hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_NEEDS_CONFIRMATION)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Payment ₹${amount.toInt()} detected")
            .setContentText("$candidateCount pending orders match this amount — tap to confirm which one")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
        context.getSystemService(NotificationManager::class.java)
            .notify(("confirm-$amount").hashCode(), notification)
    }
}
