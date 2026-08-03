package com.misticraft.admin.data.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class OrderItem(
    val id: String = "",
    val name: String = "",
    val price: Double = 0.0,
    val qty: Int = 1,
    val img: String? = null,
    val size: String? = null
)

@Serializable
data class OrderContact(
    val email: String? = null,
    val phone: String? = null
)

@Serializable
data class OrderAddress(
    val name: String? = null,
    val street: String? = null,
    val city: String? = null,
    val pin: String? = null,
    val state: String? = null,
    val country: String? = null
)

@Serializable
data class OrderPayment(
    val method: String? = null,
    val ref: String? = null,
    val utr: String? = null
)

/**
 * Mirrors `customer_orders` (schema.sql) exactly — column names are
 * snake_case in Postgres, mapped via @SerialName the same way
 * `misticraft-data.js`'s normalizeOrderRow() bridges camelCase <-> snake_case
 * by hand on the JS side.
 *
 * IMPORTANT: the DB trigger `customer_orders_only_status_changes` only
 * allows `status`, `transporter`, `tracking_id` to change after insert —
 * every update from this app must be scoped to just those fields.
 */
@Serializable
data class CustomerOrder(
    val id: String = "",
    @SerialName("order_number") val orderNumber: String = "",
    val uid: String = "",
    val items: List<OrderItem> = emptyList(),
    val subtotal: Double = 0.0,
    val shipping: Double = 0.0,
    val total: Double = 0.0,
    val contact: OrderContact = OrderContact(),
    val address: OrderAddress = OrderAddress(),
    val payment: OrderPayment = OrderPayment(),
    val status: String = "Pending",
    @SerialName("created_at") val createdAt: String = "",
    val transporter: String? = null,
    @SerialName("tracking_id") val trackingId: String? = null
)

object OrderStatus {
    const val PENDING = "Pending"
    const val PROCESSING = "Processing"
    const val SHIPPED = "Shipped"
    const val DELIVERED = "Delivered"
    const val CANCELLED = "Cancelled"
    val ALL = listOf(PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED)
}
