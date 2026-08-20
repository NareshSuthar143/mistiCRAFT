// mistiCRAFT — alert admins on every new order: browser push + email
//
// Fired by a DB trigger (see schema.sql: notify_new_order_on_insert) on
// every customer_orders INSERT — not called from the browser, so no
// caller JWT to check (verify_jwt: false, service role, same trust
// model as delhivery-sync / delhivery-auto-create).
//
// Two independent, best-effort channels — either can be unconfigured
// without breaking the other or blocking checkout:
//   - Web Push (VAPID) to every admin browser subscribed via Settings
//     > Enable Order Alerts, reaches them even with the tab closed.
//     Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
//   - Email via Resend to settings.store_email. Needs RESEND_API_KEY
//     and RESEND_FROM (a sender verified in the Resend dashboard, or
//     Resend's shared onboarding@resend.dev for testing).
// All secrets are Edge Function secrets, never stored in the database.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { getServiceRoleKey, getSupabaseUrl, json } from "../_shared/utils.ts";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM");

function esc(s: unknown): string {
  return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

Deno.serve(async (req: Request) => {
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
    .select("order_number, total, address, items")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return json({ skipped: "order not found" });

  const addr = order.address || {};
  const amount = Math.round(Number(order.total) || 0);
  const summary = (addr.name ? addr.name + " — " : "") + "Rs. " + amount;

  const out: { push?: unknown; email?: unknown } = {};

  // ---- Web Push ----
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    out.push = { skipped: "VAPID keys not set" };
  } else {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const { data: subs } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
    if (!subs || !subs.length) {
      out.push = { skipped: "no admin push subscriptions" };
    } else {
      const payload = JSON.stringify({ title: "New order " + order.order_number, body: summary, orderId });
      const results: Array<Record<string, unknown>> = [];
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
          results.push({ id: sub.id, sent: true });
        } catch (e) {
          const statusCode = (e as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Push service says this subscription is gone for good
            // (browser uninstalled, permission revoked, etc.) — stop
            // retrying it.
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            results.push({ id: sub.id, removed: "stale" });
          } else {
            results.push({ id: sub.id, error: String(e) });
          }
        }
      }
      out.push = results;
    }
  }

  // ---- Email (Resend) ----
  if (!RESEND_API_KEY || !RESEND_FROM) {
    out.email = { skipped: "RESEND_API_KEY / RESEND_FROM not set" };
  } else {
    const { data: settings } = await supabase.from("settings").select("store_email").eq("id", 1).maybeSingle();
    const to = settings?.store_email;
    if (!to) {
      out.email = { skipped: "no store_email configured in Settings" };
    } else {
      const items: Array<{ name?: string; qty?: number }> = order.items || [];
      const itemsHtml = items.map((it) => `<li>${it.qty || 1}&times; ${esc(it.name)}</li>`).join("");
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: RESEND_FROM,
            to,
            subject: `New order ${order.order_number} — Rs. ${amount}`,
            html: `<p><strong>${esc(order.order_number)}</strong> — ${esc(summary)}</p><ul>${itemsHtml}</ul>`,
          }),
        });
        const resData = await res.json();
        out.email = res.ok ? { sent: true, id: resData?.id } : { error: resData?.message || `Resend HTTP ${res.status}` };
      } catch (e) {
        out.email = { error: String(e) };
      }
    }
  }

  return json({ order: orderId, ...out });
});
