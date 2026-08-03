package com.misticraft.admin.notification

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.misticraft.admin.data.repository.OrdersRepository
import com.misticraft.admin.data.models.OrderStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Reads notifications from UPI apps only (see PACKAGE_ALLOWLIST) to spot
 * incoming payments and match them to Pending orders. Requires the user
 * to manually grant "Notification access" in system Settings — see
 * NotificationAccessScreen for the in-app onboarding flow; Android does
 * not let an app grant this to itself.
 *
 * Reliability note: some OEM battery-optimization skins (MIUI, Samsung,
 * etc.) can still kill this service in the background even with the
 * permission granted — see the battery-exemption prompt in
 * NotificationAccessScreen, which reduces but can't fully eliminate that
 * risk. This is a platform limitation, not something fixable in code.
 */
class MistiNotificationListenerService : NotificationListenerService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val ordersRepository = OrdersRepository()

    companion object {
        // Google Pay is the named target; PhonePe/Paytm included so the
        // matcher also works if the customer used a different UPI app —
        // remove any of these if you'd rather only react to Google Pay.
        val PACKAGE_ALLOWLIST = setOf(
            "com.google.android.apps.nbu.paisa.user", // Google Pay (India)
            "com.phonepe.app",                          // PhonePe
            "net.one97.paytm"                            // Paytm
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in PACKAGE_ALLOWLIST) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString()
        val text = extras.getCharSequence(android.app.Notification.EXTRA_TEXT)?.toString()

        val payment = NotificationParser.parse(title, text)
        if (payment.amount == null && payment.utr == null) return // not a payment-looking notification

        serviceScope.launch {
            handlePayment(payment)
        }
    }

    private suspend fun handlePayment(payment: com.misticraft.admin.notification.ParsedPayment) {
        val pending = runCatching { ordersRepository.fetchPending() }.getOrNull() ?: return
        when (val result = OrderMatcher.match(payment, pending)) {
            is MatchResult.AutoAccept -> {
                runCatching { ordersRepository.updateStatus(result.order.id, OrderStatus.PROCESSING) }
                    .onSuccess {
                        NotificationHelper.notifyAutoAccepted(
                            applicationContext,
                            result.order.orderNumber,
                            "₹${result.order.total.toInt()}"
                        )
                    }
            }
            is MatchResult.Ambiguous -> {
                NotificationHelper.notifyNeedsConfirmation(
                    applicationContext,
                    result.amount,
                    result.candidates.size
                )
            }
            MatchResult.NoMatch -> {
                // Not a mistiCRAFT payment (or the order isn't in our
                // Pending list, e.g. paid before this device had
                // notification access) — nothing actionable to do.
            }
        }
    }
}
