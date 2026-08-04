package com.misticraft.admin.data.repository

import com.misticraft.admin.data.SupabaseClientProvider
import com.misticraft.admin.data.models.StoreSettings
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

/** Mirrors getSettings/subscribeSettings/saveSettings in misticraft-data.js. */
class SettingsRepository {
    private val client = SupabaseClientProvider.client

    suspend fun fetch(): StoreSettings =
        client.postgrest.from("settings")
            .select { filter { eq("id", 1) } }
            .decodeSingleOrNull() ?: StoreSettings()

    fun subscribe(): Flow<StoreSettings> = callbackFlow {
        trySend(fetch())
        val channel = client.realtime.channel("mc-settings")
        val changeFlow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "settings"
        }
        // UNDISPATCHED so collect() (and the channel registration it
        // triggers) runs synchronously before channel.subscribe() joins
        // — see OrdersRepository.kt for the full explanation.
        val job = launch(start = CoroutineStart.UNDISPATCHED) { changeFlow.collect { trySend(fetch()) } }
        channel.subscribe()
        awaitClose {
            job.cancel()
            launch { channel.unsubscribe() }
        }
    }

    suspend fun save(settings: StoreSettings) {
        client.postgrest.from("settings").upsert(settings.copy(id = 1)) {
            onConflict = "id"
        }
    }
}
