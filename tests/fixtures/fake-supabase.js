// Fake Supabase client for browser-driven tests against this static
// site. Injected via page.addInitScript() before any page script runs,
// on every navigation, so misticraft-data.js sees a real-looking
// window.sb and every page's own inline script runs completely
// unmodified — only the network transport is replaced.
//
// All state is delegated to window.__mockDb(op, args), which the test
// script exposes (page.exposeFunction) backed by a plain object in the
// Node process. That's what makes state survive real full-page
// navigations (product.html -> cart.html -> checkout.html), the same
// way a real Supabase-backed session would.
//
// The real Supabase SDK (loaded from a CDN in each page's <head>) has
// no network to reach in a sandboxed/offline test run, so
// supabase-init.js's own `window.sb = supabase.createClient(...)`
// silently no-ops (its own guard clause catches `typeof supabase ===
// 'undefined'`), leaving this fake in place.
(function () {
  var TEST_UID = 'test-uid-00000000-0000-0000-0000-000000000001';
  var TEST_USER = { id: TEST_UID, is_anonymous: true, email: null, user_metadata: {} };

  function call(op, args) { return window.__mockDb(op, args || {}); }
  function resolved(data, error) { return Promise.resolve({ data: data === undefined ? null : data, error: error || null }); }

  function productsTable() {
    return {
      select: function () {
        return {
          eq: function (col, val) {
            return { maybeSingle: function () { return call('products.getOne', { col: col, val: val }).then(function (row) { return { data: row ? { stock: row.stock } : null, error: null }; }); } };
          },
          then: function (res, rej) { return call('products.all', {}).then(function (rows) { return { data: rows, error: null }; }).then(res, rej); }
        };
      },
      update: function (payload) {
        return { eq: function (col, val) { return call('products.update', { col: col, val: val, payload: payload }).then(function () { return { data: null, error: null }; }); } };
      }
    };
  }

  function cartsTable() {
    return {
      select: function () {
        return {
          eq: function (col, val) {
            return { maybeSingle: function () { return call('carts.get', { uid: val }).then(function (items) { return { data: { items: items || [] }, error: null }; }); } };
          }
        };
      },
      upsert: function (payload) { return call('carts.set', { uid: payload.uid, items: payload.items }).then(function () { return { data: null, error: null }; }); }
    };
  }

  function settingsTable() {
    return {
      select: function () { return { eq: function () { return { maybeSingle: function () { return call('settings.get', {}).then(function (s) { return { data: s, error: null }; }); } }; } }; }
    };
  }

  function profilesTable() {
    return {
      select: function () {
        return { eq: function (col, val) { return { maybeSingle: function () { return call('profiles.get', { uid: val }).then(function (p) { return { data: p, error: null }; }); } }; } };
      },
      upsert: function (payload) { return call('profiles.set', payload).then(function () { return { data: null, error: null }; }); }
    };
  }

  function customerOrdersTable() {
    return {
      insert: function (payload) { return call('orders.create', payload).then(function () { return { data: null, error: null }; }); }
    };
  }

  var TABLES = { products: productsTable, carts: cartsTable, settings: settingsTable, profiles: profilesTable, customer_orders: customerOrdersTable };

  window.sb = {
    from: function (name) {
      if (!TABLES[name]) { console.warn('[fake-supabase] unhandled table', name); return { select: function () { return { then: function (r) { return resolved([]).then(r); } }; } }; }
      return TABLES[name]();
    },
    auth: {
      onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
      getSession: function () { return resolved({ session: { user: TEST_USER } }); },
      signInAnonymously: function () { return resolved({ user: TEST_USER }); }
    },
    channel: function () {
      var self = { on: function () { return self; }, subscribe: function () { return self; } };
      return self;
    },
    removeChannel: function () {},
    storage: { from: function () { return { upload: function () { return resolved(null); }, getPublicUrl: function () { return { data: { publicUrl: 'https://example.com/x.jpg' } } } } } },
    rpc: function () { return resolved([]); }
  };
})();
