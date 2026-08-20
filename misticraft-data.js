/* ============================================================
   mistiCRAFT shared data layer — Supabase edition
   Products, artisans, orders, carts, wishlists & accounts used
   across the storefront and the workshop admin panel.

   Backed by Postgres (data) via PostgREST, Supabase Auth (accounts,
   including an anonymous session for guests so carts persist without
   a login) and Supabase Storage (product/artisan photo uploads).
   Realtime (postgres_changes) means admin edits appear on the live
   storefront instantly, on every open tab, without reloads.

   Requires supabase-init.js to run first (see that file).
   ============================================================ */
(function (root) {
  var KEYS = { products: 'products', artisans: 'artisans', orders: 'orders', founders: 'founders' };

  var DEFAULT_PRODUCTS = [];

  var DEFAULT_ARTISANS = [];

  var DEFAULT_FOUNDERS = [
    {id:"founder-ceo",name:"Add Your Name",role:"Founder & CEO",quote:"Replace this with your own story — why you started mistiCRAFT and what you want it to stand for.",img:"https://placehold.co/400x400/2a2620/e8c165?text=Founder+%26+CEO"},
    {id:"co-founder",name:"Add Co-Founder Name",role:"Co-Founder",quote:"Replace this with your co-founder's story, or delete this card from the admin panel if there isn't one.",img:"https://placehold.co/400x400/2a2620/e8c165?text=Co-Founder"}
  ];

  var DEFAULT_ORDERS = [];

  var CATEGORY_LABELS = {
    'custom-tshirts':'Custom T-Shirts','shirts':'Shirts','denim-jackets':'Denim Jackets',
    'handbags':'Handbags','accessories':'Accessories','bottoms':'Bottoms'
  };
  var TECHNIQUE_LABELS = {
    'embroidery':'Embroidery','patch-work':'Patch Work','beadwork':'Beadwork',
    'hand-painted':'Hand-Painted','block-print':'Block Print'
  };

  /* top < center < bottom. Stable sort keeps same-rank products in their
     existing relative order (insertion/DB order), so this is safe to
     apply as the default ("Featured") ordering on shop/homepage grids. */
  var RANK_ORDER = { top: 0, center: 1, bottom: 2 };
  function sortByRank(products) {
    return products.slice().sort(function (a, b) {
      var ra = RANK_ORDER.hasOwnProperty(a.rank) ? RANK_ORDER[a.rank] : 1;
      var rb = RANK_ORDER.hasOwnProperty(b.rank) ? RANK_ORDER[b.rank] : 1;
      return ra - rb;
    });
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function formatINR(n) {
    n = Math.round(Number(n) || 0);
    return '\u20B9' + n.toLocaleString('en-IN');
  }

  /* Indian PIN code -> {city, state} lookup, used to auto-fill address
     forms. Free, no-key public API (India Post data). Returns null on
     any failure (invalid/unknown PIN, network error) so callers can
     just leave the city/state fields for the user to fill manually. */
  async function lookupPincode(pin) {
    if (!/^[1-9][0-9]{5}$/.test(String(pin || ''))) return null;
    try {
      var res = await fetch('https://api.postalpincode.in/pincode/' + pin);
      var data = await res.json();
      var entry = data && data[0];
      var po = entry && entry.Status === 'Success' && entry.PostOffice && entry.PostOffice[0];
      if (!po) return null;
      return { city: po.District || '', state: po.State || '' };
    } catch (e) {
      console.error('mistiCRAFT pincode lookup error', e);
      return null;
    }
  }

  function uid(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 7);
  }

  function slugify(s) {
    return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || uid('item');
  }

  function genUUID() {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function db() {
    if (typeof window === 'undefined' || !window.sb) {
      throw new Error('Supabase is not initialized — check supabase-init.js and your network connection.');
    }
    return window.sb;
  }

  /* ---------- Generic table read/write (products, artisans, orders) ----------
     Keeps the exact loadData/saveData contract the storefront pages already
     use, just backed by Postgres tables instead of window.storage/Firestore. */
  async function loadData(key, seed) {
    try {
      var client = db();
      var res = await client.from(key).select('*');
      if (res.error) throw res.error;
      var data = res.data || [];
      if (data.length === 0 && seed && seed.length) {
        var ins = await client.from(key).insert(seed);
        if (ins.error) throw ins.error;
        res = await client.from(key).select('*');
        if (res.error) throw res.error;
        data = res.data || [];
      }
      return data.length ? data : clone(seed);
    } catch (e) {
      console.error('mistiCRAFT loadData error (' + key + ')', e);
      return clone(seed);
    }
  }

  async function saveData(key, data) {
    try {
      var client = db();
      var existing = await client.from(key).select('id');
      if (existing.error) throw existing.error;
      var keep = {};
      data.forEach(function (item) { keep[String(item.id)] = true; });
      var toDelete = (existing.data || []).filter(function (r) { return !keep[String(r.id)]; }).map(function (r) { return r.id; });
      if (toDelete.length) {
        var del = await client.from(key).delete().in('id', toDelete);
        if (del.error) throw del.error;
      }
      if (data.length) {
        var up = await client.from(key).upsert(data, { onConflict: 'id' });
        if (up.error) throw up.error;
      }
      return true;
    } catch (e) {
      console.error('mistiCRAFT saveData error (' + key + ')', e);
      return false;
    }
  }

  /* Live updates: call once, get called back on every change (including
     immediately with current data). Returns an unsubscribe function. */
  function subscribe(key, onData) {
    try {
      var client = db();
      var refetch = async function () {
        var res = await client.from(key).select('*');
        if (!res.error) onData(res.data || []);
        else console.error('mistiCRAFT subscribe refetch error (' + key + ')', res.error);
      };
      refetch();
      var channel = client.channel('mc-' + key + '-' + Math.random().toString(36).slice(2, 8))
        .on('postgres_changes', { event: '*', schema: 'public', table: key }, refetch)
        .subscribe();
      return function () { client.removeChannel(channel); };
    } catch (e) {
      console.error('mistiCRAFT subscribe init error (' + key + ')', e);
      return function () {};
    }
  }

  /* ---------------- Auth ---------------- */
  var authReadyResolve;
  var authReadyPromise = new Promise(function (res) { authReadyResolve = res; });
  var authReadyDone = false;
  var cachedUser = null;

  async function initAuthWatcher() {
    var client = db();
    client.auth.onAuthStateChange(function (_event, session) {
      cachedUser = session ? session.user : null;
      document.dispatchEvent(new CustomEvent('mistiauth:change', { detail: { user: cachedUser } }));
    });
    try {
      var got = await client.auth.getSession();
      if (got.data && got.data.session && got.data.session.user) {
        cachedUser = got.data.session.user;
      } else {
        var anon = await client.auth.signInAnonymously();
        if (anon.error) throw anon.error;
        cachedUser = anon.data.user;
      }
    } catch (e) {
      console.error('mistiCRAFT anonymous sign-in error', e);
      cachedUser = null;
    }
    authReadyDone = true;
    authReadyResolve(cachedUser);
  }
  if (typeof window !== 'undefined' && window.sb) initAuthWatcher();

  function authReady() { return authReadyPromise; }
  function currentUser() { return cachedUser; }
  function onAuthChange(cb) {
    try {
      return db().auth.onAuthStateChange(function (_event, session) { cb(session ? session.user : null); });
    } catch (e) {
      console.error('mistiCRAFT onAuthChange init error', e);
      return { data: { subscription: { unsubscribe: function () {} } } };
    }
  }

  async function mergeGuestData(fromUid, toUid) {
    try {
      var fromCart = await cartGet(fromUid);
      if (fromCart.length) {
        var toCart = await cartGet(toUid);
        await cartSet(toUid, mergeCartArrays(toCart, fromCart));
        await cartSet(fromUid, []);
      }
    } catch (e) { console.error('mistiCRAFT cart merge error', e); }
    try {
      var fromWish = await wishlistGet(fromUid);
      if (fromWish.length) {
        var toWish = await wishlistGet(toUid);
        await wishlistSet(toUid, mergeUniqueById(toWish, fromWish));
      }
    } catch (e) { console.error('mistiCRAFT wishlist merge error', e); }
  }

  function mergeCartArrays(a, b) {
    var out = clone(a);
    b.forEach(function (item) {
      var existing = out.find(function (x) { return x.id === item.id && x.size === item.size; });
      if (existing) existing.qty = Math.min(9, existing.qty + item.qty);
      else out.push(item);
    });
    return out;
  }
  function mergeUniqueById(a, b) {
    var out = clone(a);
    b.forEach(function (item) {
      if (!out.find(function (x) { return x.id === item.id; })) out.push(item);
    });
    return out;
  }

  /* Sign up: upgrades the current anonymous session in place (same uid,
     so cart/wishlist carry over) if one exists, else creates a fresh
     account. NOTE: with Supabase's default settings, this may require
     the person to confirm a link sent to their email before the identity
     fully attaches — see SETUP-SUPABASE.md to toggle that requirement. */
  async function signUp(email, password, name) {
    var client = db();
    var user = cachedUser;
    var result;
    if (user && user.is_anonymous) {
      result = await client.auth.updateUser({ email: email, password: password, data: name ? { name: name } : undefined });
    } else {
      result = await client.auth.signUp({ email: email, password: password, options: name ? { data: { name: name } } : undefined });
    }
    if (result.error) throw result.error;
    var resultUser = result.data.user;
    if (resultUser) await saveProfile(resultUser.id, { name: name || '', email: email });
    return resultUser;
  }

  async function logIn(email, password) {
    var client = db();
    var prev = cachedUser;
    var prevUid = (prev && prev.is_anonymous) ? prev.id : null;
    var result = await client.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
    if (prevUid && result.data.user && prevUid !== result.data.user.id) {
      await mergeGuestData(prevUid, result.data.user.id);
    }
    return result.data.user;
  }

  function logOut() {
    try { return db().auth.signOut(); }
    catch (e) { console.error('mistiCRAFT logOut error', e); return Promise.resolve({ error: e }); }
  }

  async function isAdmin(uid) {
    if (!uid) return false;
    try {
      var res = await db().from('admins').select('uid').eq('uid', uid).maybeSingle();
      if (res.error) throw res.error;
      return !!res.data;
    } catch (e) { console.error('mistiCRAFT isAdmin error', e); return false; }
  }

  async function getProfile(uid) {
    try {
      var res = await db().from('profiles').select('*').eq('uid', uid).maybeSingle();
      if (res.error) throw res.error;
      return res.data || null;
    } catch (e) { console.error('mistiCRAFT getProfile error', e); return null; }
  }
  async function saveProfile(uid, patch) {
    try {
      var payload = Object.assign({ uid: uid }, patch);
      var res = await db().from('profiles').upsert(payload, { onConflict: 'uid' });
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT saveProfile error', e); return false; }
  }

  /* ---------------- Store settings (single row, id=1) ---------------- */
  async function getSettings() {
    try {
      var res = await db().from('settings').select('*').eq('id', 1).maybeSingle();
      if (res.error) throw res.error;
      return res.data || { shipping_fee: 99, store_email: '', store_phone: '', default_transporter: '', upi_id: '', upi_payee_name: '', hero_media_url: '', hero_media: [] };
    } catch (e) {
      console.error('mistiCRAFT getSettings error', e);
      return { shipping_fee: 99, store_email: '', store_phone: '', default_transporter: '', upi_id: '', upi_payee_name: '', hero_media_url: '', hero_media: [] };
    }
  }
  function subscribeSettings(cb) {
    try {
      var client = db();
      var refetch = async function () { cb(await getSettings()); };
      refetch();
      var channel = client.channel('mc-settings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, refetch)
        .subscribe();
      return function () { client.removeChannel(channel); };
    } catch (e) {
      console.error('mistiCRAFT subscribeSettings init error', e);
      cb({ shipping_fee: 99, store_email: '', store_phone: '', default_transporter: '', upi_id: '', upi_payee_name: '', hero_media_url: '', hero_media: [] });
      return function () {};
    }
  }
  async function saveSettings(patch) {
    try {
      var payload = Object.assign({ id: 1 }, patch);
      var res = await db().from('settings').upsert(payload, { onConflict: 'id' });
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT saveSettings error', e); return false; }
  }

  /* ---------------- Cart (one row per user: carts.uid) ---------------- */
  async function cartGet(uid) {
    try {
      var res = await db().from('carts').select('items').eq('uid', uid).maybeSingle();
      if (res.error) throw res.error;
      return (res.data && res.data.items) || [];
    } catch (e) { console.error('mistiCRAFT cartGet error', e); return []; }
  }
  async function cartSet(uid, items) {
    try {
      var res = await db().from('carts').upsert({ uid: uid, items: items, updated_at: new Date().toISOString() }, { onConflict: 'uid' });
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT cartSet error', e); return false; }
  }
  function cartSubscribe(uid, cb) {
    var client = db();
    var refetch = async function () { cb(await cartGet(uid)); };
    refetch();
    var channel = client.channel('mc-cart-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carts', filter: 'uid=eq.' + uid }, refetch)
      .subscribe();
    return function () { client.removeChannel(channel); };
  }
  async function cartAdd(uid, item) {
    var items = await cartGet(uid);
    var existing = items.find(function (x) { return x.id === item.id && x.size === item.size; });
    if (existing) existing.qty = Math.min(9, existing.qty + (item.qty || 1));
    else items.push(Object.assign({ qty: 1, size: null }, item));
    await cartSet(uid, items);
    return items;
  }
  async function cartUpdateQty(uid, id, size, qty) {
    var items = await cartGet(uid);
    var it = items.find(function (x) { return x.id === id && x.size === size; });
    if (it) it.qty = Math.max(1, Math.min(9, qty));
    await cartSet(uid, items);
    return items;
  }
  async function cartRemove(uid, id, size) {
    var items = await cartGet(uid);
    items = items.filter(function (x) { return !(x.id === id && x.size === size); });
    await cartSet(uid, items);
    return items;
  }
  async function cartClear(uid) { await cartSet(uid, []); }

  /* ---------------- Wishlist (one row per user: wishlists.uid) ---------------- */
  async function wishlistGet(uid) {
    try {
      var res = await db().from('wishlists').select('items').eq('uid', uid).maybeSingle();
      if (res.error) throw res.error;
      return (res.data && res.data.items) || [];
    } catch (e) { console.error('mistiCRAFT wishlistGet error', e); return []; }
  }
  async function wishlistSet(uid, items) {
    try {
      var res = await db().from('wishlists').upsert({ uid: uid, items: items, updated_at: new Date().toISOString() }, { onConflict: 'uid' });
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT wishlistSet error', e); return false; }
  }
  function wishlistSubscribe(uid, cb) {
    var client = db();
    var refetch = async function () { cb(await wishlistGet(uid)); };
    refetch();
    var channel = client.channel('mc-wishlist-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlists', filter: 'uid=eq.' + uid }, refetch)
      .subscribe();
    return function () { client.removeChannel(channel); };
  }
  async function wishlistToggle(uid, product) {
    var items = await wishlistGet(uid);
    var idx = items.findIndex(function (x) { return x.id === product.id; });
    var added;
    if (idx > -1) { items.splice(idx, 1); added = false; } else { items.push(product); added = true; }
    await wishlistSet(uid, items);
    return { items: items, added: added };
  }

  /* ---------------- Customer orders (created at checkout) ----------------
     Kept separate from the `orders` table above, which powers the existing
     Workshop Admin "Order Fulfillment" board (production orders placed
     with artisan units — a different concept from a shopper's purchase).
     DB columns are snake_case (order_number, created_at); normalizeOrderRow
     maps them to the camelCase shape the rest of the app already expects. */
  function normalizeOrderRow(row) {
    if (!row) return row;
    return {
      id: row.id,
      orderNumber: row.order_number || row.orderNumber,
      uid: row.uid,
      items: row.items || [],
      subtotal: row.subtotal,
      shipping: row.shipping,
      total: row.total,
      contact: row.contact || {},
      address: row.address || {},
      payment: row.payment || {},
      status: row.status,
      transporter: row.transporter || '',
      trackingId: row.tracking_id || row.trackingId || '',
      createdAt: row.created_at ? new Date(row.created_at).getTime() : (row.createdAt || Date.now())
    };
  }
  async function createOrder(order) {
    var client = db();
    var id = genUUID();
    var orderNumber = 'MC-' + id.replace(/-/g, '').slice(-6).toUpperCase();
    var payload = {
      id: id,
      order_number: orderNumber,
      uid: order.uid,
      items: order.items,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      contact: order.contact,
      address: order.address,
      payment: order.payment,
      status: 'Pending'
    };
    var res = await client.from('customer_orders').insert(payload);
    if (res.error) throw res.error;
    return normalizeOrderRow(Object.assign({ created_at: new Date().toISOString() }, payload));
  }
  function subscribeCustomerOrders(cb) {
    var client = db();
    var refetch = async function () {
      var res = await client.from('customer_orders').select('*').order('created_at', { ascending: false });
      if (!res.error) cb((res.data || []).map(normalizeOrderRow));
      else console.error('mistiCRAFT customerOrders subscribe error', res.error);
    };
    refetch();
    var channel = client.channel('mc-customer-orders-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, refetch)
      .subscribe();
    return function () { client.removeChannel(channel); };
  }
  function subscribeUserOrders(uid, cb) {
    var client = db();
    var refetch = async function () {
      var res = await client.from('customer_orders').select('*').eq('uid', uid).order('created_at', { ascending: false });
      if (!res.error) cb((res.data || []).map(normalizeOrderRow));
      else console.error('mistiCRAFT user orders subscribe error', res.error);
    };
    refetch();
    var channel = client.channel('mc-customer-orders-user-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders', filter: 'uid=eq.' + uid }, refetch)
      .subscribe();
    return function () { client.removeChannel(channel); };
  }
  /* ---------------- Live order tracking ----------------
     A fine-grained stage timeline (tracking_events) sits underneath the
     coarse `status` column. Every status change — from the admin
     dropdown here, or from the transporter's own link — is written as
     a tracking_events row; a DB trigger (see schema.sql) keeps
     customer_orders.status in sync automatically. Neither the
     transporter nor a tracking customer ever gets an auth session:
     both go through SECURITY DEFINER Postgres functions that check a
     secret token / contact match themselves. */
  var STAGE_LABELS = {
    placed: 'Order Placed',
    processing: 'Processing',
    shipped: 'Shipped',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  };
  var STATUS_TO_STAGE = {
    'Pending': 'placed',
    'Processing': 'processing',
    'Shipped': 'shipped',
    'Delivered': 'delivered',
    'Cancelled': 'cancelled'
  };
  function normalizeTrackingEvents(events) {
    return (events || []).map(function (e) {
      return { stage: e.stage, label: STAGE_LABELS[e.stage] || e.stage, note: e.note || '', createdAt: e.created_at ? new Date(e.created_at).getTime() : Date.now() };
    });
  }
  async function updateCustomerOrderStatus(orderId, status) {
    try {
      var stage = STATUS_TO_STAGE[status] || 'processing';
      var res = await db().from('tracking_events').insert({ order_id: orderId, stage: stage });
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT updateCustomerOrderStatus error', e); return false; }
  }
  async function updateOrderLogistics(orderId, logistics) {
    try {
      var res = await db().from('customer_orders').update({
        transporter: logistics.transporter || null,
        tracking_id: logistics.trackingId || null
      }).eq('id', orderId);
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT updateOrderLogistics error', e); return false; }
  }
  /* Uploads a generated invoice PDF (see invoice.js generateBlob) to the
     'invoices' bucket, keyed by the order's own UUID so the link is
     shareable (public bucket) without being guessable/enumerable. RLS
     only lets the order's own owner (or admin) write this path. */
  async function uploadInvoicePdf(orderId, blob) {
    var path = orderId + '.pdf';
    var client = db();
    var res = await client.storage.from('invoices').upload(path, blob, { contentType: 'application/pdf', upsert: true });
    if (res.error) throw res.error;
    var pub = client.storage.from('invoices').getPublicUrl(path);
    return pub.data.publicUrl;
  }
  /* Admin-only: create a Delhivery shipment (waybill) for an order, or
     fetch its packing-slip label PDF, via the delhivery-create-shipment
     Edge Function — see that function for why this can't be done with a
     plain RPC (it needs a real HTTP call to Delhivery with a secret
     token that must never reach the browser). functions.invoke()
     automatically forwards the caller's own session token, which the
     function uses to verify admin access itself. */
  async function createDelhiveryShipment(orderId, action) {
    var res = await db().functions.invoke('delhivery-create-shipment', { body: { order_id: orderId, action: action || 'create' } });
    if (res.error) {
      var msg = res.error.message || 'Request failed';
      try {
        if (res.error.context && typeof res.error.context.json === 'function') {
          var body = await res.error.context.json();
          if (body && body.error) msg = body.error;
        }
      } catch (_e) { /* couldn't parse the error body — fall back to the generic message */ }
      throw new Error(msg);
    }
    if (res.data && res.data.error) throw new Error(res.data.error);
    return res.data;
  }
  /* Admin-only: save/remove this browser's Web Push subscription so the
     notify-new-order Edge Function can push a real OS notification the
     moment a new order lands — even with the admin dashboard tab closed.
     RLS on push_subscriptions restricts writes to the signed-in admin's
     own uid; only the Edge Function (service role) ever reads all rows. */
  async function pushSubscribe(subscription) {
    var user = currentUser();
    if (!user) throw new Error('Not signed in.');
    var sub = subscription.toJSON();
    var client = db();
    var res = await client.from('push_subscriptions').upsert({
      uid: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth
    }, { onConflict: 'endpoint' });
    if (res.error) throw res.error;
  }
  async function pushUnsubscribe(endpoint) {
    var client = db();
    var res = await client.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (res.error) throw res.error;
  }
  /* Customer-facing: look up an order with no login, by order number
     plus the phone or email used at checkout. */
  async function trackOrder(orderNumber, contact) {
    try {
      var res = await db().rpc('track_order', { p_order_number: String(orderNumber || '').trim(), p_contact: String(contact || '').trim() });
      if (res.error) throw res.error;
      var row = (res.data || [])[0];
      if (!row) return null;
      return {
        orderNumber: row.order_number,
        status: row.status,
        items: row.items || [],
        subtotal: row.subtotal,
        shipping: row.shipping,
        total: row.total,
        transporter: row.transporter || '',
        trackingId: row.tracking_id || '',
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        events: normalizeTrackingEvents(row.events)
      };
    } catch (e) { console.error('mistiCRAFT trackOrder error', e); return null; }
  }
  async function decrementStock(items) {
    try {
      var client = db();
      for (var i = 0; i < items.length; i++) {
        var got = await client.from('products').select('stock').eq('id', items[i].id).maybeSingle();
        if (got.error) throw got.error;
        if (got.data) {
          var newStock = Math.max(0, (got.data.stock || 0) - items[i].qty);
          var upd = await client.from('products').update({ stock: newStock }).eq('id', items[i].id);
          if (upd.error) throw upd.error;
        }
      }
      return true;
    } catch (e) { console.error('mistiCRAFT decrementStock error', e); return false; }
  }

  /* ---------------- Image upload (Storage) ----------------
     Downscales large photos client-side first (longest edge capped) so
     uploads stay fast and product pages stay light. `folder` looks like
     'product-images/<id>' — the part before the first slash is the
     Storage bucket name, the rest is the path within that bucket. */
  function resizeImageFile(file, maxDim) {
    maxDim = maxDim || 1600;
    return new Promise(function (resolve) {
      if (!file.type || file.type.indexOf('image/') !== 0) { resolve(file); return; }
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.width, h = img.height;
        if (w <= maxDim && h <= maxDim) { resolve(file); return; }
        var scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale); h = Math.round(h * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) { resolve(blob || file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  /* Accepts photos (resized/re-encoded to JPEG, as before) and, for the
     spots that opt in, videos (uploaded as-is — no client-side transcoding). */
  var VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogg|ogv)(\?.*)?$/i;
  function isVideoUrl(url) {
    return VIDEO_EXTENSIONS.test(String(url || ''));
  }
  async function uploadImage(file, folder, onProgress) {
    var isVideo = file.type && file.type.indexOf('video/') === 0;
    var resized = isVideo ? file : await resizeImageFile(file, 1600);
    var safeName = Date.now() + '-' + String(file.name || (isVideo ? 'video.mp4' : 'image.jpg')).replace(/[^a-zA-Z0-9.\-_]/g, '_');
    var slashIdx = folder.indexOf('/');
    var bucket = slashIdx > -1 ? folder.slice(0, slashIdx) : folder;
    var subPath = slashIdx > -1 ? folder.slice(slashIdx + 1) : '';
    var path = (subPath ? subPath + '/' : '') + safeName;
    var client = db();
    var res = await client.storage.from(bucket).upload(path, resized, {
      contentType: isVideo ? (file.type || 'video/mp4') : 'image/jpeg',
      upsert: true,
      onUploadProgress: function (progress) {
        if (typeof onProgress === 'function' && progress && progress.total) {
          onProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      }
    });
    if (res.error) throw res.error;
    var pub = client.storage.from(bucket).getPublicUrl(path);
    return pub.data.publicUrl;
  }

  /* ---------------- Cart badge auto-hydration ----------------
     Runs on every page once this script loads: as soon as we know who
     the visitor is (real account or anonymous session), watch their
     cart and keep any #cart-badge element in the header in sync live. */
  function watchCartBadge() {
    authReady().then(function (user) {
      if (!user) return;
      cartSubscribe(user.id, function (items) {
        var badge = document.getElementById('cart-badge');
        if (!badge) return;
        var count = items.reduce(function (s, i) { return s + (i.qty || 1); }, 0);
        badge.textContent = String(count);
      });
    });
  }
  if (typeof document !== 'undefined') watchCartBadge();

  root.mistiData = {
    KEYS: KEYS,
    DEFAULT_PRODUCTS: DEFAULT_PRODUCTS,
    DEFAULT_ARTISANS: DEFAULT_ARTISANS,
    DEFAULT_ORDERS: DEFAULT_ORDERS,
    DEFAULT_FOUNDERS: DEFAULT_FOUNDERS,
    CATEGORY_LABELS: CATEGORY_LABELS,
    TECHNIQUE_LABELS: TECHNIQUE_LABELS,
    loadData: loadData,
    saveData: saveData,
    subscribe: subscribe,
    formatINR: formatINR,
    lookupPincode: lookupPincode,
    uid: uid,
    slugify: slugify,
    sortByRank: sortByRank,
    isVideoUrl: isVideoUrl,
    authReady: authReady,
    currentUser: currentUser,
    onAuthChange: onAuthChange,
    signUp: signUp,
    logIn: logIn,
    logOut: logOut,
    isAdmin: isAdmin,
    getProfile: getProfile,
    saveProfile: saveProfile,
    getSettings: getSettings,
    subscribeSettings: subscribeSettings,
    saveSettings: saveSettings,
    cart: { get: cartGet, set: cartSet, subscribe: cartSubscribe, add: cartAdd, updateQty: cartUpdateQty, remove: cartRemove, clear: cartClear },
    wishlist: { get: wishlistGet, set: wishlistSet, subscribe: wishlistSubscribe, toggle: wishlistToggle },
    orders: { create: createOrder, subscribeAll: subscribeCustomerOrders, subscribeForUser: subscribeUserOrders, updateStatus: updateCustomerOrderStatus, updateLogistics: updateOrderLogistics, decrementStock: decrementStock },
    uploadInvoicePdf: uploadInvoicePdf,
    createDelhiveryShipment: createDelhiveryShipment,
    uploadImage: uploadImage,
    STAGE_LABELS: STAGE_LABELS,
    trackOrder: trackOrder,
    pushSubscribe: pushSubscribe,
    pushUnsubscribe: pushUnsubscribe
  };
})(window);
