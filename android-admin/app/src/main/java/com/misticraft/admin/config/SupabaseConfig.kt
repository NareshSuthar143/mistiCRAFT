package com.misticraft.admin.config

/**
 * Same pair of values as `supabase-init.js` in the web app — the anon key
 * is meant to be public (protection comes from RLS policies, not
 * secrecy). Paste your project's real values from
 * Supabase Dashboard > Project Settings > API before building.
 */
object SupabaseConfig {
    const val SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co"
    const val SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY"

    val isConfigured: Boolean
        get() = !SUPABASE_URL.contains("YOUR-PROJECT-REF") && !SUPABASE_ANON_KEY.contains("YOUR_ANON_PUBLIC_KEY")
}
