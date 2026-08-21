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
const LOGO_DATA_URI = "data:image/png;base64,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";

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
    `<td style="vertical-align:middle;padding-right:12px;"><img src="${LOGO_DATA_URI}" width="36" height="36" alt="mistiCRAFT" style="display:block;border:0;"></td>`,
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
