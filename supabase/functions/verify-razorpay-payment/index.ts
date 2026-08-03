// supabase/functions/verify-razorpay-payment/index.ts
//
// Called by checkout.html right after Razorpay's checkout modal reports
// success. Verifies the payment signature server-side (this is the step
// that actually proves money changed hands) and only then creates the
// customer_orders row, from the staged pending_orders data — never from
// whatever the client sends at this step, so a tampered client call can't
// forge a paid order.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, getSupabaseUrl, getAnonKey, getServiceRoleKey } from '../_shared/utils.ts';

const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';

async function verifySignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(RAZORPAY_KEY_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(orderId + '|' + paymentId));
  const hex = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === signature;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!RAZORPAY_KEY_SECRET) return json({ error: 'Payments are not configured yet on the server.' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);
    const anonClient = createClient(getSupabaseUrl(), getAnonKey(), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Invalid session — please refresh and try again.' }, 401);
    const uid = userData.user.id;

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: 'Missing payment details.' }, 400);
    }

    const validSignature = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!validSignature) return json({ error: 'Payment verification failed.' }, 400);

    const admin = createClient(getSupabaseUrl(), getServiceRoleKey());

    const { data: pending, error: pendErr } = await admin
      .from('pending_orders').select('*').eq('razorpay_order_id', razorpay_order_id).maybeSingle();
    if (pendErr || !pending) return json({ error: 'Could not find a matching order to confirm.' }, 400);
    if (pending.uid !== uid) return json({ error: 'This order does not belong to your account.' }, 403);

    const orderId = crypto.randomUUID();
    const orderNumber = 'MC-' + orderId.replace(/-/g, '').slice(-6).toUpperCase();

    const { error: insErr } = await admin.from('customer_orders').insert({
      id: orderId,
      order_number: orderNumber,
      uid,
      razorpay_order_id,
      razorpay_payment_id,
      payment_status: 'paid',
      items: pending.items,
      subtotal: pending.subtotal,
      shipping: pending.shipping,
      total: pending.total,
      contact: pending.contact,
      address: pending.address,
      payment: pending.payment,
      status: 'Pending',
    });
    if (insErr) {
      console.error('order insert error', insErr);
      return json({ error: 'Payment succeeded but the order could not be saved. Contact support with payment ID ' + razorpay_payment_id + '.' }, 500);
    }

    // Decrement stock now that payment + order creation are both confirmed.
    for (const item of pending.items as Array<{ id: string; qty: number }>) {
      const { data: prod } = await admin.from('products').select('stock').eq('id', item.id).maybeSingle();
      if (prod) {
        const newStock = Math.max(0, (prod.stock || 0) - item.qty);
        await admin.from('products').update({ stock: newStock }).eq('id', item.id);
      }
    }

    await admin.from('pending_orders').delete().eq('razorpay_order_id', razorpay_order_id);

    return json({
      id: orderId,
      orderNumber,
      uid,
      items: pending.items,
      subtotal: pending.subtotal,
      shipping: pending.shipping,
      total: pending.total,
      contact: pending.contact,
      address: pending.address,
      payment: pending.payment,
      status: 'Pending',
      createdAt: Date.now(),
    });
  } catch (e) {
    console.error('verify-razorpay-payment error', e);
    return json({ error: 'Unexpected server error.' }, 500);
  }
});
