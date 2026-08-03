package com.misticraft.admin.data.repository

import com.misticraft.admin.data.SupabaseClientProvider
import com.misticraft.admin.data.models.Product
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch

/**
 * Direct per-row CRUD against `products`, unlike misticraft-data.js's
 * saveData() (which upserts/deletes the *entire* array on every edit —
 * a JS-side convenience that works but isn't necessary here). Same
 * table, same RLS ("products admin write" using is_admin()), just a
 * more conventional per-row Kotlin API.
 */
class ProductsRepository {
    private val client = SupabaseClientProvider.client

    suspend fun fetchAll(): List<Product> =
        client.postgrest.from("products").select().decodeList()

    fun subscribeAll(): Flow<List<Product>> = callbackFlow {
        trySend(fetchAll())
        val channel = client.realtime.channel("mc-products")
        val changeFlow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "products"
        }
        val job = launch { changeFlow.collect { trySend(fetchAll()) } }
        channel.subscribe()
        awaitClose {
            job.cancel()
            launch { channel.unsubscribe() }
        }
    }

    suspend fun upsert(product: Product) {
        client.postgrest.from("products").upsert(product) {
            onConflict = "id"
        }
    }

    suspend fun delete(id: String) {
        client.postgrest.from("products").delete {
            filter { eq("id", id) }
        }
    }
}
