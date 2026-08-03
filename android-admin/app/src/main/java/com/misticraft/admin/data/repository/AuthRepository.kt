package com.misticraft.admin.data.repository

import com.misticraft.admin.data.SupabaseClientProvider
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.Serializable

@Serializable
private data class AdminRow(val uid: String)

/**
 * Mirrors the auth + admin-gate logic in misticraft-data.js
 * (authReady/signUp/logIn/logOut/isAdmin) and admin.html's own
 * "only accounts in the `admins` table see the dashboard" check
 * (schema.sql:76-79) — enforced here for UX, and again server-side by
 * RLS regardless, same as the web admin.
 */
class AuthRepository {
    private val client = SupabaseClientProvider.client

    val currentUserId: String?
        get() = client.auth.currentUserOrNull()?.id

    suspend fun signIn(email: String, password: String) {
        client.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signOut() {
        client.auth.signOut()
    }

    suspend fun isCurrentUserAdmin(): Boolean {
        val uid = currentUserId ?: return false
        val row = client.postgrest.from("admins")
            .select(columns = Columns.list("uid")) {
                filter { eq("uid", uid) }
            }
            .decodeSingleOrNull<AdminRow>()
        return row != null
    }
}
