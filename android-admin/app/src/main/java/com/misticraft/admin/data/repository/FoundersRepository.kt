package com.misticraft.admin.data.repository

import com.misticraft.admin.data.SupabaseClientProvider
import com.misticraft.admin.data.models.Founder
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch

class FoundersRepository {
    private val client = SupabaseClientProvider.client

    suspend fun fetchAll(): List<Founder> =
        client.postgrest.from("founders").select().decodeList()

    fun subscribeAll(): Flow<List<Founder>> = callbackFlow {
        trySend(fetchAll())
        val channel = client.realtime.channel("mc-founders")
        val changeFlow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "founders"
        }
        val job = launch { changeFlow.collect { trySend(fetchAll()) } }
        channel.subscribe()
        awaitClose {
            job.cancel()
            launch { channel.unsubscribe() }
        }
    }

    suspend fun upsert(founder: Founder) {
        client.postgrest.from("founders").upsert(founder) {
            onConflict = "id"
        }
    }

    suspend fun delete(id: String) {
        client.postgrest.from("founders").delete {
            filter { eq("id", id) }
        }
    }
}
