/* ============================================================
   mistiCRAFT — Supabase bootstrap
   1) Create project: https://supabase.com/dashboard
   2) Project Settings > API — copy "Project URL" + "anon public" key.
   3) Paste both below.
   4) Authentication > Providers — enable Email, enable Anonymous.
   5) SQL Editor — run schema.sql (tables + RLS + storage + realtime).
   Full walkthrough: SETUP-SUPABASE.md
   ============================================================ */
window.MISTI_SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
window.MISTI_SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";

(function () {
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('mistiCRAFT: Supabase SDK did not load (network/ad-blocker?). Data features unavailable.');
    return;
  }
  if (window.MISTI_SUPABASE_URL.indexOf('YOUR-PROJECT-REF') > -1) {
    console.warn('mistiCRAFT: supabase-init.js still has placeholder config — add your project URL/anon key. See SETUP-SUPABASE.md.');
  }
  window.sb = supabase.createClient(window.MISTI_SUPABASE_URL, window.MISTI_SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
})();
