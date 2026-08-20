// mistiCRAFT — push a real OS notification to every admin on a new order
//
// Fired by a DB trigger (see schema.sql: notify_new_order_on_insert) on
// every customer_orders INSERT — not called from the browser, so no
// caller JWT to check (verify_jwt: false, service role, same trust
// model as delhivery-sync / delhivery-auto-create).
//
// Sends via the Web Push protocol (VAPID), so it reaches admins even
// with the dashboard tab closed — that's the whole point over the
// existing in-app bell, which only shows once someone opens the page.
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT are Edge
// Function secrets, never stored in the database.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { getServiceRoleKey, getSupabaseUrl, json } from "../_shared/utils.ts";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

Deno.serve(async (req: Request) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return json({ skipped: "VAPID keys not set — add VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT under Edge Functions > Secrets." });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let body: { order_id?: string };
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const orderId = body.order_id;
  if (!orderId) return json({ error: "order_id is required." }, 400);

  const supabase = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: order } = await supabase
    .from("customer_orders")
    .select("order_number, total, address")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return json({ skipped: "order not found" });

  const { data: subs } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (!subs || !subs.length) return json({ skipped: "no admin push subscriptions" });

  const addr = order.address || {};
  const payload = JSON.stringify({
    title: "New order " + order.order_number,
    body: (addr.name ? addr.name + " — " : "") + "Rs. " + Math.round(Number(order.total) || 0),
    orderId,
  });

  const results: Array<Record<string, unknown>> = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      results.push({ id: sub.id, sent: true });
    } catch (e) {
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Push service says this subscription is gone for good (browser
        // uninstalled, permission revoked, etc.) — stop retrying it.
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        results.push({ id: sub.id, removed: "stale" });
      } else {
        results.push({ id: sub.id, error: String(e) });
      }
    }
  }
  return json({ order: orderId, results });
});
