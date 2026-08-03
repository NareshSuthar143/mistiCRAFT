// Shared helpers for mistiCRAFT edge functions.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Supabase auto-provides project keys as env vars, but the exact variable
// name has changed across Supabase generations (SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY vs newer SUPABASE_PUBLISHABLE_KEYS /
// SUPABASE_SECRET_KEYS JSON maps). These helpers work with either, so the
// functions keep working regardless of which your project uses.
function firstFromJsonMap(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const vals = Object.values(parsed);
      if (vals.length) return String(vals[0]);
    }
  } catch (_e) { /* not JSON, ignore */ }
  return null;
}

export function getSupabaseUrl(): string {
  return Deno.env.get('SUPABASE_URL') || '';
}
export function getAnonKey(): string {
  return firstFromJsonMap(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')) || Deno.env.get('SUPABASE_ANON_KEY') || '';
}
export function getServiceRoleKey(): string {
  return firstFromJsonMap(Deno.env.get('SUPABASE_SECRET_KEYS')) || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
