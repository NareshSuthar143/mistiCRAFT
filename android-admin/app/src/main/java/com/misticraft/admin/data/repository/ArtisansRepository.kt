package com.misticraft.admin.data.repository

import com.misticraft.admin.data.SupabaseClientProvider
import com.misticraft.admin.data.models.Artisan
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch

class ArtisansRepository {
    private val client = SupabaseClientProvider.client

    suspend fun fetchAll(): List<Artisan> =
        client.postgrest.from("artisans").select().decodeList()

    fun subscribeAll(): Flow<List<Artisan>> = callbackFlow {
        trySend(fetchAll())
        val channel = client.realtime.channel("mc-artisans")
        val changeFlow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "artisans"
        }
        // UNDISPATCHED so collect() (and the channel registration it
        // triggers) runs synchronously before channel.subscribe() joins
        // — see OrdersRepository.kt for the full explanation.
        val job = launch(start = CoroutineStart.UNDISPATCHED) { changeFlow.collect { trySend(fetchAll()) } }
        channel.subscribe()
        awaitClose {
            job.cancel()
            launch { channel.unsubscribe() }
        }
    }

    suspend fun upsert(artisan: Artisan) {
        client.postgrest.from("artisans").upsert(artisan) {
            onConflict = "id"
        }
    }

    suspend fun delete(id: String) {
        client.postgrest.from("artisans").delete {
            filter { eq("id", id) }
        }
    }
}
