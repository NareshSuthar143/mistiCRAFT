// mistiCRAFT — auto-create Delhivery shipment right after checkout
//
// Fired by a DB trigger (see schema.sql: delhivery_auto_create_on_order)
// on every customer_orders INSERT — not called from the browser, so no
// caller JWT to check (verify_jwt: false, same trust model as
// delhivery-sync: service role, no input trusted besides order_id).
//
// This only creates the waybill early so the label/tracking ID exist
// as soon as checkout completes. It does NOT request a Delhivery
// pickup — Delhivery only collects a package once a pickup is
// separately requested (dashboard or admin action), so a freshly
// created shipment just sits unpicked-up until the order is actually
// packed (2-3 days), same as a "draft". Nothing here blocks checkout:
// every failure just leaves transporter/tracking_id empty, and the
// admin's existing "Auto-Create Delhivery Label" button in Order
// Details still works as a manual retry.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getServiceRoleKey, getSupabaseUrl, json } from "../_shared/utils.ts";

const DELHIVERY_API_TOKEN = Deno.env.get("DELHIVERY_API_TOKEN");

Deno.serve(async (req: Request) => {
  if (!DELHIVERY_API_TOKEN) return json({ skipped: "DELHIVERY_API_TOKEN not set" });

  let body: { order_id?: string };
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const orderId = body.order_id;
  if (!orderId) return json({ error: "order_id is required." }, 400);

  const supabase = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: order, error: orderError } = await supabase
    .from("customer_orders")
    .select("id, order_number, items, total, contact, address, transporter, tracking_id, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) return json({ error: orderError.message }, 500);
  if (!order) return json({ error: "Order not found." }, 404);
  if (order.transporter && order.tracking_id) return json({ skipped: "already has a tracking ID" });

  const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  if (!settings?.delhivery_pickup_location) return json({ skipped: "no Delhivery pickup location configured" });

  const addr = order.address || {};
  const contact = order.contact || {};
  const missing = ["name", "street", "city", "state", "pin"].filter((f) => !String(addr[f] || "").trim());
  if (!String(contact.phone || "").trim()) missing.push("phone");
  if (missing.length) return json({ skipped: `order missing address fields: ${missing.join(", ")}` });

  const items: Array<{ id?: string; name?: string; qty?: number }> = order.items || [];
  const productIds = items.map((it) => it.id).filter(Boolean) as string[];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, weight_grams").in("id", productIds)
    : { data: [] as Array<{ id: string; weight_grams: number | null }> };
  const weightById = new Map((products || []).map((p) => [p.id, p.weight_grams]));

  const defaultWeight = Number(settings.default_package_weight_grams) || 500;
  const totalWeight = items.reduce((sum, it) => {
    const qty = Number(it.qty) || 1;
    const perItem = it.id && weightById.has(it.id) && weightById.get(it.id) != null ? Number(weightById.get(it.id)) : defaultWeight;
    return sum + perItem * qty;
  }, 0) || defaultWeight;
  const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 1), 0) || 1;
  const productsDesc = items.map((it) => it.name).filter(Boolean).join(", ") || order.order_number;

  const shipmentPayload = {
    shipments: [
      {
        waybill: "",
        order: order.order_number,
        order_date: new Date(order.created_at).toISOString().slice(0, 19).replace("T", " "),
        total_amount: Number(order.total) || 0,
        name: addr.name,
        add: addr.street,
        city: addr.city,
        state: addr.state,
        country: addr.country || "India",
        phone: contact.phone,
        pin: addr.pin,
        payment_mode: "Prepaid",
        products_desc: productsDesc,
        cod_amount: 0,
        shipment_width: Number(settings.default_package_width_cm) || 25,
        shipment_height: Number(settings.default_package_height_cm) || 5,
        shipment_length: Number(settings.default_package_length_cm) || 30,
        weight: totalWeight,
        quantity: totalQty,
      },
    ],
    pickup_location: { name: settings.delhivery_pickup_location },
  };

  const res = await fetch("https://track.delhivery.com/api/cmu/create.json", {
    method: "POST",
    headers: {
      Authorization: `Token ${DELHIVERY_API_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `format=json&data=${encodeURIComponent(JSON.stringify(shipmentPayload))}`,
  });

  const resText = await res.text();
  let resData: Record<string, unknown>;
  try {
    resData = JSON.parse(resText);
  } catch (_e) {
    return json({ skipped: `Delhivery returned a non-JSON response (HTTP ${res.status})` });
  }

  const pkg = (resData.packages as Array<Record<string, unknown>> | undefined)?.[0];
  const waybill = pkg?.waybill as string | undefined;
  if (!res.ok || !waybill || pkg?.status === "Fail" || resData.success === false) {
    const remark = Array.isArray(pkg?.remarks) ? (pkg?.remarks as string[]).join("; ") : (pkg?.remarks as string | undefined);
    // Left empty on purpose — the admin's manual "Auto-Create Delhivery
    // Label" button (same underlying flow) is the retry path.
    return json({ skipped: remark || pkg?.status || "Delhivery rejected the shipment" });
  }

  const { error: updateError } = await supabase
    .from("customer_orders")
    .update({ transporter: "Delhivery", tracking_id: waybill })
    .eq("id", orderId);
  if (updateError) return json({ error: `Shipment created (waybill ${waybill}) but saving it to the order failed: ${updateError.message}` }, 500);

  return json({ success: true, waybill });
});
