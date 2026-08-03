// supabase/functions/create-razorpay-order/index.ts
//
// Called by checkout.html before opening the Razorpay checkout modal.
// Prices are NEVER trusted from the client — every item's price is
// re-read from the `products` table here, so a tampered client request
// can't create a cheap Razorpay order for expensive items.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, getSupabaseUrl, getAnonKey, getServiceRoleKey } from '../_shared/utils.ts';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || '';
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return json({ error: 'Payments are not configured yet on the server (missing Razorpay keys).' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const anonClient = createClient(getSupabaseUrl(), getAnonKey(), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Invalid session — please refresh and try again.' }, 401);
    const uid = userData.user.id;

    const body = await req.json();
    const cartItems: Array<{ id: string; qty: number; size?: string | null }> = Array.isArray(body.items) ? body.items : [];
    if (!cartItems.length) return json({ error: 'Your bag is empty.' }, 400);

    const admin = createClient(getSupabaseUrl(), getServiceRoleKey());

    // Re-price every item from the database — never trust client prices.
    const ids = [...new Set(cartItems.map((i) => i.id))];
    const { data: products, error: prodErr } = await admin.from('products').select('id,name,price,img,stock').in('id', ids);
    if (prodErr) return json({ error: 'Could not load product data.' }, 500);
    const byId: Record<string, any> = {};
    (products || []).forEach((p: any) => { byId[p.id] = p; });

    const items: Array<{ id: string; name: string; price: number; img: string; size: string | null; qty: number }> = [];
    for (const ci of cartItems) {
      const p = byId[ci.id];
      if (!p) return json({ error: 'One of the items in your bag is no longer available.' }, 400);
      const qty = Math.max(1, Math.min(9, Math.round(Number(ci.qty) || 1)));
      if ((p.stock || 0) < qty) return json({ error: '"' + p.name + '" doesn\'t have enough stock left.' }, 400);
      items.push({ id: p.id, name: p.name, price: Number(p.price) || 0, img: p.img, size: ci.size || null, qty });
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const { data: settings } = await admin.from('settings').select('shipping_fee').eq('id', 1).maybeSingle();
    const shipping = settings && settings.shipping_fee != null ? Number(settings.shipping_fee) : 99;
    const total = subtotal + shipping;
    if (total <= 0) return json({ error: 'Order total must be greater than zero.' }, 400);

    const contact = body.contact || {};
    const address = body.address || {};
    const paymentMethod = body.paymentMethod === 'upi' ? 'upi' : 'card';

    const rpAuth = 'Basic ' + btoa(RAZORPAY_KEY_ID + ':' + RAZORPAY_KEY_SECRET);
    const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: rpAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(total * 100), // paise
        currency: 'INR',
        receipt: 'mc-' + Date.now(),
      }),
    });
    const rpData = await rpRes.json();
    if (!rpRes.ok) {
      return json({ error: (rpData && rpData.error && rpData.error.description) || 'Razorpay order creation failed.' }, 400);
    }

    const { error: stageErr } = await admin.from('pending_orders').upsert({
      razorpay_order_id: rpData.id,
      uid,
      items,
      subtotal,
      shipping,
      total,
      contact,
      address,
      payment: { method: paymentMethod },
    });
    if (stageErr) return json({ error: 'Could not stage order for payment.' }, 500);

    return json({ orderId: rpData.id, amount: rpData.amount, currency: rpData.currency, keyId: RAZORPAY_KEY_ID });
  } catch (e) {
    console.error('create-razorpay-order error', e);
    return json({ error: 'Unexpected server error.' }, 500);
  }
});
