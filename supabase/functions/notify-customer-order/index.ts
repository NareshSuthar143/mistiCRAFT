// mistiCRAFT — order confirmation email + PDF invoice, sent to the customer
//
// Fired by a DB trigger (see schema.sql: notify_customer_order_on_insert)
// on every customer_orders INSERT — not called from the browser, so no
// caller JWT to check (verify_jwt: false, service role, same trust model
// as delhivery-sync / delhivery-auto-create / notify-new-order).
//
// This is the customer-facing counterpart to notify-new-order (which
// alerts the admin). Sends via Resend to order.contact.email, with the
// tax invoice attached as a real PDF (built server-side with jsPDF,
// mirroring the same layout invoice.js already generates client-side
// for the admin panel) rather than just an HTML summary.
// Needs RESEND_API_KEY / RESEND_FROM Edge Function secrets — same ones
// notify-new-order uses. Best-effort: any failure here never blocks
// checkout, since it only ever runs after the order row already exists.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";
import { getServiceRoleKey, getSupabaseUrl, json } from "../_shared/utils.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM");
const SITE_URL = "https://misti-craft.vercel.app";
const LOGO_URL = "https://pdntxosjtacqgvzavtio.supabase.co/storage/v1/object/public/email-assets/logo.png";

function esc(s: unknown): string {
  return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}
function money(n: unknown): string {
  return "Rs. " + Math.round(Number(n) || 0).toLocaleString("en-IN");
}

type OrderAddress = { name?: string; street?: string; city?: string; state?: string; pin?: string; country?: string };
type OrderContact = { phone?: string; email?: string };
type OrderItem = { name?: string; qty?: number; size?: string; price?: number };
type Order = {
  order_number: string;
  subtotal: number;
  shipping: number;
  total: number;
  address: OrderAddress;
  contact: OrderContact;
  payment: { method?: string } | null;
  items: OrderItem[];
  created_at: string;
};

// ---- PDF invoice, mirroring invoice.js's layout ----
function buildInvoicePdf(order: Order): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 18;
  let y = 20;
  const addr = order.address || {};
  const contact = order.contact || {};

  function line(y1: number) {
    doc.setDrawColor(200);
    doc.line(marginX, y1, pageW - marginX, y1);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("mistiCRAFT", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Handcrafted goods", marginX, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TAX INVOICE", pageW - marginX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Invoice #: " + esc(order.order_number), pageW - marginX, y + 6, { align: "right" });
  const dateStr = new Date(order.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  doc.text("Date: " + dateStr, pageW - marginX, y + 11, { align: "right" });

  y += 24;
  line(y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Bill To", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  if (addr.name) { doc.text(esc(addr.name), marginX, y); y += 5; }
  if (addr.street) { doc.text(esc(addr.street), marginX, y); y += 5; }
  const cityLine = [addr.city, addr.state, addr.pin].filter(Boolean).join(", ");
  if (cityLine) { doc.text(cityLine, marginX, y); y += 5; }
  if (addr.country) { doc.text(esc(addr.country), marginX, y); y += 5; }
  const contactLine = [contact.email, contact.phone].filter(Boolean).join("   ·   ");
  if (contactLine) { doc.text(contactLine, marginX, y); y += 5; }

  y += 4;
  line(y);
  y += 8;

  const col = { item: marginX, qty: pageW - marginX - 62, price: pageW - marginX - 42, total: pageW - marginX };
  doc.setFont("helvetica", "bold");
  doc.text("Item", col.item, y);
  doc.text("Qty", col.qty, y, { align: "right" });
  doc.text("Price", col.price, y, { align: "right" });
  doc.text("Total", col.total, y, { align: "right" });
  y += 3;
  line(y);
  y += 6;
  doc.setFont("helvetica", "normal");

  for (const it of order.items || []) {
    if (y + 6 > 280) { doc.addPage(); y = 20; }
    const label = esc(it.name) + (it.size ? ` (Size ${esc(it.size)})` : "");
    doc.text(label, col.item, y, { maxWidth: pageW - marginX * 2 - 70 });
    doc.text(String(it.qty || 1), col.qty, y, { align: "right" });
    doc.text(money(it.price), col.price, y, { align: "right" });
    doc.text(money((Number(it.price) || 0) * (Number(it.qty) || 1)), col.total, y, { align: "right" });
    y += 7;
  }

  y += 2;
  line(y);
  y += 8;

  doc.text("Subtotal", col.price, y, { align: "right" });
  doc.text(money(order.subtotal), col.total, y, { align: "right" });
  y += 6;
  doc.text("Shipping", col.price, y, { align: "right" });
  doc.text(money(order.shipping), col.total, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", col.price, y, { align: "right" });
  doc.text(money(order.total), col.total, y, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  y += 12;
  const payMethod = order.payment?.method ? order.payment.method.toUpperCase() : "—";
  doc.text("Payment Method: " + payMethod, marginX, y);
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Thank you for shopping with mistiCRAFT.", marginX, y);
  y += 5;
  doc.text("This is a system-generated invoice and does not require a signature.", marginX, y);

  return doc.output("datauristring").split(",")[1]; // base64 only
}

// ---- Confirmation email, matching notify-new-order's brand header ----
function buildConfirmationHtml(order: Order): string {
  const addr = order.address || {};
  const contact = order.contact || {};
  const trackUrl = `${SITE_URL}/track.html?order=${encodeURIComponent(order.order_number)}&contact=${encodeURIComponent(contact.email || contact.phone || "")}`;
  const addrLines = [esc(addr.name), esc(addr.street), [addr.city, addr.state, addr.pin].filter(Boolean).map(esc).join(", "), esc(addr.country)].filter(Boolean).join("<br>");
  const itemRows = (order.items || [])
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
    `<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#b5502e;font-weight:700;margin-bottom:8px;">Order Confirmed</div>`,
    `<div style="font-size:20px;font-weight:700;color:#1e1b18;">Thank you${addr.name ? ", " + esc(addr.name) : ""}!</div>`,
    `<div style="font-size:15px;color:#5b564e;margin-top:4px;">Order ${esc(order.order_number)} &middot; ${money(order.total)}</div>`,
    `</td></tr>`,
    `<tr><td style="padding:16px 28px 0;">`,
    `<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8378;font-weight:700;margin-bottom:6px;">Shipping To</div>`,
    `<div style="font-size:14px;color:#1e1b18;line-height:1.6;">${addrLines || "No address on file"}</div>`,
    `</td></tr>`,
    `<tr><td style="padding:20px 28px 8px;">`,
    `<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8378;font-weight:700;margin-bottom:8px;">Items</div>`,
    `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;color:#1e1b18;">${itemRows}</table>`,
    `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;color:#5b564e;margin-top:8px;">`,
    `<tr><td style="padding:3px 0;">Subtotal</td><td style="padding:3px 0;text-align:right;">${money(order.subtotal)}</td></tr>`,
    `<tr><td style="padding:3px 0;">Shipping</td><td style="padding:3px 0;text-align:right;">${money(order.shipping)}</td></tr>`,
    `<tr><td style="padding:6px 0;font-weight:700;color:#1e1b18;">Total</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#1e1b18;">${money(order.total)}</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `<tr><td style="padding:20px 28px 28px;">`,
    `<a href="${trackUrl}" style="display:inline-block;background:#1e1b18;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:.04em;text-transform:uppercase;font-weight:700;padding:12px 24px;border-radius:4px;">Track Your Order &rarr;</a>`,
    `</td></tr>`,
    `<tr><td style="padding:14px 28px;background:#f7f5f2;border-top:1px solid #e5e1d8;">`,
    `<span style="font-size:11px;color:#8a8378;">Your tax invoice is attached to this email as a PDF. Thank you for shopping with mistiCRAFT.</span>`,
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

  if (!RESEND_API_KEY || !RESEND_FROM) {
    return json({ skipped: "RESEND_API_KEY / RESEND_FROM not set" });
  }

  const supabase = createClient(getSupabaseUrl(), getServiceRoleKey());
  const { data: order } = await supabase
    .from("customer_orders")
    .select("order_number, subtotal, shipping, total, address, contact, payment, items, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return json({ skipped: "order not found" });

  const to = order.contact?.email;
  if (!to) return json({ skipped: "order has no contact email" });

  try {
    const pdfBase64 = buildInvoicePdf(order as Order);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to,
        subject: `Your mistiCRAFT order ${order.order_number} is confirmed`,
        html: buildConfirmationHtml(order as Order),
        attachments: [{ filename: `mistiCRAFT-Invoice-${order.order_number}.pdf`, content: pdfBase64 }],
      }),
    });
    const resData = await res.json();
    return json({ order: orderId, email: res.ok ? { sent: true, id: resData?.id } : { error: resData?.message || `Resend HTTP ${res.status}` } });
  } catch (e) {
    return json({ order: orderId, email: { error: String(e) } });
  }
});
