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
//     index.html), hosted in the email-assets storage bucket and
//     linked by URL — Gmail and most clients strip/block inline
//     data: URI images in received mail, so it has to be a real,
//     independently-fetchable image, not embedded base64.
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
const LOGO_URL = "https://pdntxosjtacqgvzavtio.supabase.co/storage/v1/object/public/email-assets/logo.png";

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
    `<td style="vertical-align:middle;padding-right:12px;"><img src="${LOGO_URL}" width="36" height="36" alt="mistiCRAFT" style="display:block;border:0;"></td>`,
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
    // store_email supports comma/semicolon-separated addresses (e.g.
    // "owner@x.com, meena@x.com") so the alert can go to more than one
    // person — same field the invoice header also reads, just split here.
    const to = String(settings?.store_email || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (!to.length) {
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
