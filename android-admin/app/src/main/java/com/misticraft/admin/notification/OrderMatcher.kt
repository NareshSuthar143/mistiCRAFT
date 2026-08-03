package com.misticraft.admin.notification

import com.misticraft.admin.data.models.CustomerOrder
import java.time.Duration
import java.time.Instant
import kotlin.math.abs

sealed class MatchResult {
    data class AutoAccept(val order: CustomerOrder, val reason: String) : MatchResult()
    data class Ambiguous(val candidates: List<CustomerOrder>, val amount: Double) : MatchResult()
    object NoMatch : MatchResult()
}

/**
 * Per the explicit product decision: a UTR match is unambiguous by
 * definition (it's a real bank transaction id) and always auto-accepts.
 * An amount-only match auto-accepts ONLY when exactly one Pending order
 * has that amount within the lookback window — any more than one
 * candidate is treated as ambiguous and is surfaced for manual
 * confirmation instead of guessing.
 */
object OrderMatcher {
    private val LOOKBACK = Duration.ofHours(24)
    private const val AMOUNT_EPSILON = 0.01

    fun match(payment: ParsedPayment, pendingOrders: List<CustomerOrder>, now: Instant = Instant.now()): MatchResult {
        payment.utr?.let { utr ->
            val byUtr = pendingOrders.firstOrNull { it.payment.utr == utr }
            if (byUtr != null) {
                return MatchResult.AutoAccept(byUtr, reason = "UTR $utr matched exactly")
            }
        }

        val amount = payment.amount ?: return MatchResult.NoMatch

        val candidates = pendingOrders.filter { order ->
            abs(order.total - amount) < AMOUNT_EPSILON && isWithinLookback(order.createdAt, now)
        }

        return when (candidates.size) {
            0 -> MatchResult.NoMatch
            1 -> MatchResult.AutoAccept(candidates[0], reason = "Amount ₹$amount matched a single pending order")
            else -> MatchResult.Ambiguous(candidates, amount)
        }
    }

    private fun isWithinLookback(createdAtIso: String, now: Instant): Boolean {
        val createdAt = runCatching { Instant.parse(createdAtIso) }.getOrNull() ?: return false
        return Duration.between(createdAt, now) <= LOOKBACK
    }
}
