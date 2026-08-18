// mistiCRAFT — Delhivery tracking sync
//
// Polls Delhivery's Track API for every in-progress order shipped via
// Delhivery, and appends a tracking_events row whenever the shipment's
// stage has advanced. tracking_events already has a DB trigger (see
// schema.sql) that keeps customer_orders.status in sync automatically,
// so this function only ever needs to write to tracking_events.
//
// Invoked on a schedule by pg_cron + pg_net (see schema.sql). Runs with
// no caller auth (verify_jwt: false) since it takes no input from the
// caller — it only acts on customer_orders rows already in the DB —
// and reads DELHIVERY_API_TOKEN from an Edge Function secret, never
// from the request.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getSupabaseUrl, getServiceRoleKey, json } from "../_shared/utils.ts";

const DELHIVERY_API_TOKEN = Deno.env.get("DELHIVERY_API_TOKEN");

// Coarser than the app's stage vocabulary is ordered here so we only ever
// move a shipment's timeline forward, never backward on a stale/out-of-order API response.
const STAGE_RANK: Record<string, number> = {
  placed: 0,
  processing: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
  cancelled: 5,
};

function mapDelhiveryToStage(statusText: unknown, latestScanInstructions: unknown): string | null {
  const status = String(statusText || "").toLowerCase();
  const scanText = String(latestScanInstructions || "").toLowerCase();
  if (status.includes("delivered")) return "delivered";
  if (status.includes("cancel") || status.includes("rto") || status.includes("lost")) return "cancelled";
  if (scanText.includes("out for delivery")) return "out_for_delivery";
  if (status.includes("transit") || status.includes("dispatch") || status.includes("pending")) return "shipped";
  if (status.includes("manifest") || status.includes("not picked")) return "processing";
  return null;
}

Deno.serve(async (_req: Request) => {
  if (!DELHIVERY_API_TOKEN) {
    return json({ error: "DELHIVERY_API_TOKEN is not set — add it under Edge Functions > Secrets in the Supabase dashboard." }, 500);
  }

  const supabase = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: orders, error } = await supabase
    .from("customer_orders")
    .select("id, tracking_id, status")
    .ilike("transporter", "delhivery")
    .not("tracking_id", "is", null)
    .not("status", "in", "(Delivered,Cancelled)");

  if (error) return json({ error: error.message }, 500);

  const results: Record<string, unknown>[] = [];

  for (const order of orders || []) {
    const waybill = String(order.tracking_id || "").trim();
    if (!waybill) continue;

    try {
      const res = await fetch(
        `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}&token=${DELHIVERY_API_TOKEN}`
      );
      if (!res.ok) {
        results.push({ order: order.id, waybill, error: `Delhivery HTTP ${res.status}` });
        continue;
      }
      const data = await res.json();
      const shipment = data?.ShipmentData?.[0]?.Shipment;
      if (!shipment) {
        results.push({ order: order.id, waybill, error: "No shipment data in Delhivery response" });
        continue;
      }

      const statusText = shipment.Status?.Status;
      const scans = shipment.Scans || [];
      const latestScan = scans[scans.length - 1];
      const latestInstructions = latestScan?.ScanDetail?.Instructions;
      const stage = mapDelhiveryToStage(statusText, latestInstructions);
      if (!stage) {
        results.push({ order: order.id, waybill, skipped: "unrecognized Delhivery status", statusText });
        continue;
      }

      const { data: lastEvent } = await supabase
        .from("tracking_events")
        .select("stage")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastRank = lastEvent ? STAGE_RANK[lastEvent.stage] ?? -1 : -1;
      if (STAGE_RANK[stage] <= lastRank) {
        results.push({ order: order.id, waybill, skipped: "no forward progress", stage });
        continue;
      }

      const note = latestScan?.ScanDetail?.Scan || null;
      const { error: insertError } = await supabase.from("tracking_events").insert({ order_id: order.id, stage, note });
      if (insertError) {
        results.push({ order: order.id, waybill, error: insertError.message });
        continue;
      }
      results.push({ order: order.id, waybill, stage, updated: true });
    } catch (e) {
      results.push({ order: order.id, waybill, error: String(e) });
    }
  }

  return json({ checked: (orders || []).length, results });
});
