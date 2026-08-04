package com.misticraft.admin.config

/**
 * Same pair of values as `supabase-init.js` in the web app — the anon key
 * is meant to be public (protection comes from RLS policies, not
 * secrecy). Paste your project's real values from
 * Supabase Dashboard > Project Settings > API before building.
 */
object SupabaseConfig {
    const val SUPABASE_URL = "https://pdntxosjtacqgvzavtio.supabase.co"
    const val SUPABASE_ANON_KEY = "sb_publishable_9VBe2wn_cBTRWd2hpdbKjA_1evZh79g"

    val isConfigured: Boolean
        get() = !SUPABASE_URL.contains("YOUR-PROJECT-REF") && !SUPABASE_ANON_KEY.contains("YOUR_ANON_PUBLIC_KEY")
}
