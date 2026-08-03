package com.misticraft.admin.data.repository

import com.misticraft.admin.data.SupabaseClientProvider
import com.misticraft.admin.data.models.CustomerOrder
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
private data class StatusPatch(val status: String)

/**
 * Mirrors `mistiData.orders` in misticraft-data.js — subscribeCustomerOrders
 * refetches the whole table on ANY realtime change (rather than trying to
 * decode granular row diffs), so this does the same thing for consistency
 * with the web admin's behavior.
 *
 * IMPORTANT: updateStatus only ever sets `status`. The `customer_orders`
 * trigger (schema.sql customer_orders_only_status_changes) rejects any
 * update that touches order_number/uid/items/subtotal/shipping/total/
 * contact/address/payment/created_at — never add fields to that update
 * call without checking the trigger first.
 */
class OrdersRepository {
    private val client = SupabaseClientProvider.client

    /** One-shot fetch — used by the notification matcher to check current
     *  Pending orders the moment a payment notification arrives. */
    suspend fun fetchAll(): List<CustomerOrder> {
        return client.postgrest.from("customer_orders")
            .select {
                order("created_at", Order.DESCENDING)
            }
            .decodeList()
    }

    suspend fun fetchPending(): List<CustomerOrder> {
        return client.postgrest.from("customer_orders")
            .select {
                filter { eq("status", "Pending") }
                order("created_at", Order.DESCENDING)
            }
            .decodeList()
    }

    /** Live list, refetched on every insert/update/delete — same pattern
     *  as subscribeCustomerOrders in misticraft-data.js. */
    fun subscribeAll(): Flow<List<CustomerOrder>> = callbackFlow {
        trySend(fetchAll())

        val channel = client.realtime.channel("mc-customer-orders-all")
        val changeFlow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "customer_orders"
        }
        val job = launch {
            changeFlow.collect { trySend(fetchAll()) }
        }
        channel.subscribe()

        awaitClose {
            job.cancel()
            launch { channel.unsubscribe() }
        }
    }

    suspend fun updateStatus(orderId: String, status: String) {
        client.postgrest.from("customer_orders")
            .update(StatusPatch(status)) {
                filter { eq("id", orderId) }
            }
    }
}
