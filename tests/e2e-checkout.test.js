#!/usr/bin/env node
// End-to-end checkout test: drives the real, unmodified product.html ->
// cart.html -> checkout.html flow in a headless browser and verifies a
// shopper can place an order start to finish (add to bag, cart totals,
// UPI payment modal, UTR validation, order confirmation) plus the
// exact payload that would be written to customer_orders.
//
// Only the network transport (the Supabase client, window.sb) is
// replaced with an in-memory fake — see fixtures/fake-supabase.js —
// so every page's own code runs for real. This means the test never
// touches a live Supabase project: no real order is created, no real
// stock is decremented, nothing to clean up afterward. It does NOT
// cover server-side behavior (RLS policies, DB triggers, schema
// constraints) — see schema.sql for that layer.
//
// Requires the `playwright` package and its Chromium browser
// (`npx playwright install chromium` once, if not already present).
//
// Usage: node tests/e2e-checkout.test.js
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const FAKE_SUPABASE = fs.readFileSync(path.join(__dirname, 'fixtures/fake-supabase.js'), 'utf8');
const TEST_UID = 'test-uid-00000000-0000-0000-0000-000000000001';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// The mock "database" — lives in this Node process so it survives
// real full-page navigations, exactly like a real Supabase-backed
// session would.
function makeDb() {
  return {
    products: [{
      id: 'test-tee', name: 'Test Embroidered Tee', category: 'custom-tshirts', technique: 'embroidery',
      tagline: 'End-to-end test product', price: 1999, mrp: 2499, stock: 10, status: 'active',
      featured: false, img: 'https://example.com/tee.jpg', images: ['https://example.com/tee.jpg'], image_fit: 'cover', rank: 'center'
    }],
    carts: {},
    profiles: {},
    settings: { id: 1, shipping_fee: 99, store_email: '', store_phone: '', default_transporter: '', upi_id: 'teststore@upi', upi_payee_name: 'Test Store', hero_media_url: '', hero_media: [] },
    orders: []
  };
}

function handleMockDb(db, op, args) {
  switch (op) {
    case 'products.all': return db.products;
    case 'products.getOne': { const p = db.products.find((p) => p[args.col] === args.val); return p ? { stock: p.stock } : null; }
    case 'products.update': { const p = db.products.find((p) => p[args.col] === args.val); if (p) Object.assign(p, args.payload); return null; }
    case 'carts.get': return db.carts[args.uid] || [];
    case 'carts.set': db.carts[args.uid] = args.items; return null;
    case 'settings.get': return db.settings;
    case 'profiles.get': return db.profiles[args.uid] || null;
    case 'profiles.set': db.profiles[args.uid] = Object.assign({}, db.profiles[args.uid], args); return null;
    case 'orders.create': db.orders.push(args); return null;
    default: throw new Error('unhandled mock op: ' + op);
  }
}

async function run() {
  const server = await startServer();
  const baseUrl = 'http://127.0.0.1:' + server.address().port;
  const db = makeDb();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.exposeFunction('__mockDb', (op, args) => handleMockDb(db, op, args));
    await page.addInitScript({ content: FAKE_SUPABASE });

    // ---- product.html: add to bag ----
    await page.goto(baseUrl + '/product.html?id=test-tee', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#unit-price');
    const productTitle = await page.$eval('h1', (el) => el.textContent.trim());
    assert.equal(productTitle, 'Test Embroidered Tee', 'product page should hydrate the mocked product');
    await page.click('label[for="size-m"]');
    await page.evaluate(() => window.addToBag());
    await page.waitForFunction(() => document.querySelector('#cart-badge')?.textContent !== '0');
    assert.deepEqual(
      db.carts[TEST_UID]?.map((i) => ({ id: i.id, qty: i.qty, size: i.size })),
      [{ id: 'test-tee', qty: 1, size: 'M' }],
      'cart should contain exactly the added item'
    );

    // ---- cart.html: item persists across a real page navigation ----
    await page.goto(baseUrl + '/cart.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cart-subtotal:not(:empty)');
    const cartSubtotal = await page.$eval('#cart-subtotal', (el) => el.textContent);
    assert.equal(cartSubtotal, '₹1,999', 'cart page should show the correct subtotal');

    // ---- checkout.html: totals, form, UPI payment, order creation ----
    await page.goto(baseUrl + '/checkout.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#checkout-submit-btn').hasAttribute('disabled'));
    assert.equal(await page.$eval('#co-subtotal', (el) => el.textContent), '₹1,999');
    assert.equal(await page.$eval('#co-shipping', (el) => el.textContent), '₹99');
    assert.equal(await page.$eval('#co-total', (el) => el.textContent), '₹2,098', 'checkout total should be subtotal + shipping');

    await page.fill('#co-email', 'e2e-test@example.com');
    await page.fill('#co-phone', '9876543210');
    await page.fill('#co-name', 'E2E Test Buyer');
    await page.fill('#co-street', '123 Test Lane');
    await page.fill('#co-city', 'Udaipur');
    await page.fill('#co-pin', '313001');
    await page.fill('#co-state', 'Rajasthan');
    await page.click('#checkout-submit-btn');

    await page.waitForSelector('#upi-pay-modal.flex');
    assert.equal(await page.$eval('#upi-modal-amount', (el) => el.textContent), '₹2,098');
    const upiLink = await page.$eval('#upi-pay-link', (el) => el.getAttribute('href'));
    assert.match(upiLink, /^upi:\/\/pay\?pa=teststore%40upi&pn=Test%20Store&am=2098\.00&cu=INR&/, 'UPI deep link should carry the right payee/amount');
    assert.ok(await page.$eval('#upi-qr-canvas', (c) => c.width > 0 && c.height > 0), 'UPI QR code should render');

    // A malformed UTR must be rejected before an order is created.
    await page.fill('#upi-utr-input', '123');
    await page.click('#upi-confirm-btn');
    await page.waitForSelector('#upi-utr-error:not(.hidden)');
    assert.equal(db.orders.length, 0, 'no order should be created while the UTR is invalid');

    await page.fill('#upi-utr-input', '987654321098');
    await page.click('#upi-confirm-btn');
    await page.waitForSelector('#order-confirmation.flex');

    const orderNumber = await page.$eval('#order-number', (el) => el.textContent);
    assert.match(orderNumber, /^MC-[A-Z0-9]+$/, 'a real order number should be generated');

    // ---- side effects: the exact write path the DB would have received ----
    assert.equal(db.orders.length, 1, 'exactly one order should be created');
    const order = db.orders[0];
    assert.equal(order.status, 'Pending');
    assert.equal(order.subtotal, 1999);
    assert.equal(order.shipping, 99);
    assert.equal(order.total, 2098);
    assert.deepEqual(order.contact, { email: 'e2e-test@example.com', phone: '9876543210' });
    assert.equal(order.address.name, 'E2E Test Buyer');
    assert.equal(order.payment.utr, '987654321098');
    assert.equal(db.products.find((p) => p.id === 'test-tee').stock, 9, 'stock should decrement by the ordered quantity');
    assert.deepEqual(db.carts[TEST_UID], [], 'cart should be cleared after checkout');
    assert.equal(db.profiles[TEST_UID]?.phone, '9876543210', 'profile should be saved with the checkout contact/address');

    const unexpectedErrors = pageErrors.filter((e) => !/lookupPincode|Failed to fetch/.test(e));
    assert.deepEqual(unexpectedErrors, [], 'no unexpected uncaught page errors');

    console.log('PASS — full checkout flow: add to bag -> cart -> checkout -> UPI payment -> order confirmed');
    console.log('  order:', orderNumber, '| total:', mistiFormatCheck(order.total));
  } finally {
    await browser.close();
    server.close();
  }
}

function mistiFormatCheck(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

run().catch((err) => {
  console.error('FAIL —', err.message);
  process.exitCode = 1;
});
