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
//     Resend's shared onboarding@resend.dev for testing). The email
//     uses the same brand mark as the storefront nav (.brand-logo in
//     index.html) as an inline data: URI, so it renders with no
//     external image request.
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
const ADMIN_URL = "https://misti-craft.vercel.app/admin.html";
const LOGO_DATA_URI = "data:image/png;base64,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";

function esc(s: unknown): string {
  return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

type OrderAddress = { name?: string; street?: string; city?: string; state?: string; pin?: string; country?: string };
type OrderContact = { phone?: string; email?: string };
type OrderItem = { name?: string; qty?: number; size?: string; price?: number };

function buildEmailHtml(
  orderNumber: string,
  amount: number,
  createdAt: string,
  addr: OrderAddress,
  contact: OrderContact,
  items: OrderItem[],
): string {
  const dateStr = new Date(createdAt).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const addrLines = [esc(addr.name), esc(addr.street), [addr.city, addr.state, addr.pin].filter(Boolean).map(esc).join(", "), esc(addr.country)].filter(Boolean).join("<br>");
  const phoneLine = contact.phone ? `<br>Ph: ${esc(contact.phone)}` : "";
  const itemRows = items
    .map((it) => {
      const label = esc(it.name) + (it.size ? ` (Size ${esc(it.size)})` : "");
      const lineTotal = Math.round((Number(it.price) || 0) * (Number(it.qty) || 1));
      return `<tr style="border-bottom:1px solid #eee;"><td style="padding:6px 0;">${it.qty || 1}&times; ${label}</td><td style="padding:6px 0;text-align:right;">Rs. ${lineTotal}</td></tr>`;
    })
    .join("");

  return [
    `<div style="background:#f2efe9;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">`,
    `<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e1d8;">`,
    `<tr><td style="background:#fbf9f4;padding:22px 28px;border-bottom:1px solid #e5e1d8;">`,
    `<table role="presentation" style="border-collapse:collapse;"><tr>`,
    `<td style="vertical-align:middle;padding-right:12px;"><img src="${LOGO_DATA_URI}" width="36" height="36" alt="mistiCRAFT" style="display:block;border:0;"></td>`,
    `<td style="vertical-align:middle;"><span style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:24px;color:#775a19;letter-spacing:-.01em;">misti<span style="font-weight:800;">CRAFT</span></span></td>`,
    `</tr></table>`,
    `</td></tr>`,
    `<tr><td style="padding:24px 28px 0;">`,
    `<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#b5502e;font-weight:700;margin-bottom:8px;">New Order</div>`,
    `<div style="font-size:22px;font-weight:700;color:#1e1b18;">${esc(orderNumber)}</div>`,
    `<div style="font-size:15px;color:#5b564e;margin-top:2px;">Rs. ${amount.toLocaleString("en-IN")} &middot; ${esc(dateStr)}</div>`,
    `</td></tr>`,
    `<tr><td style="padding:16px 28px 0;">`,
    `<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8378;font-weight:700;margin-bottom:6px;">Ship To</div>`,
    `<div style="font-size:14px;color:#1e1b18;line-height:1.6;">${addrLines || "No address on file"}${phoneLine}</div>`,
    `</td></tr>`,
    `<tr><td style="padding:20px 28px 8px;">`,
    `<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8378;font-weight:700;margin-bottom:8px;">Items</div>`,
    `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;color:#1e1b18;">${itemRows || '<tr><td style="padding:6px 0;">No items on file</td></tr>'}</table>`,
    `</td></tr>`,
    `<tr><td style="padding:20px 28px 28px;">`,
    `<a href="${ADMIN_URL}" style="display:inline-block;background:#1e1b18;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:.04em;text-transform:uppercase;font-weight:700;padding:12px 24px;border-radius:4px;">Open in Admin &rarr;</a>`,
    `</td></tr>`,
    `<tr><td style="padding:14px 28px;background:#f7f5f2;border-top:1px solid #e5e1d8;">`,
    `<span style="font-size:11px;color:#8a8378;">Automated order alert from mistiCRAFT.</span>`,
    `</td></tr>`,
    `</table>`,
    `</div>`,
  ].join("");
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
    .select("order_number, total, address, contact, items, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return json({ skipped: "order not found" });

  const addr: OrderAddress = order.address || {};
  const contact: OrderContact = order.contact || {};
  const items: OrderItem[] = order.items || [];
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
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: RESEND_FROM,
            to,
            subject: `New order ${order.order_number} — Rs. ${amount}`,
            html: buildEmailHtml(order.order_number, amount, order.created_at, addr, contact, items),
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
