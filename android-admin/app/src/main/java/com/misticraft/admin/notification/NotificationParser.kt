package com.misticraft.admin.notification

/** What we managed to pull out of a UPI app's payment notification. */
data class ParsedPayment(
    val amount: Double?,
    val utr: String?
)

/**
 * Regex-based extraction from a UPI app's notification title+text.
 *
 * This is inherently heuristic: Google Pay's notification copy isn't a
 * documented, stable API and can change between app versions. It
 * typically reads something like "You paid ₹599 to mistiCRAFT" or
 * "Payment successful — ₹599", and does NOT reliably include a custom
 * reference unless the transaction note happens to be echoed back
 * (varies by UPI app/version). The 12-digit UTR match is a bonus catch
 * when present, not something to rely on being there every time — that's
 * exactly why OrderMatcher falls back to amount-based matching, and why
 * ambiguous amount matches never auto-accept.
 */
object NotificationParser {
    // e.g. "₹599", "Rs. 1,299.50", "INR 599"
    private val amountRegex = Regex(
        """(?:₹|Rs\.?|INR)\s?([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)""",
        RegexOption.IGNORE_CASE
    )
    private val utrRegex = Regex("""\b\d{12}\b""")

    fun parse(title: String?, text: String?): ParsedPayment {
        val combined = listOfNotNull(title, text).joinToString(" ")
        val amount = amountRegex.find(combined)
            ?.groupValues?.get(1)
            ?.replace(",", "")
            ?.toDoubleOrNull()
        val utr = utrRegex.find(combined)?.value
        return ParsedPayment(amount = amount, utr = utr)
    }
}
