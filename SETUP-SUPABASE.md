# mistiCRAFT — Supabase Setup

This is the Supabase-backed version of the site (Postgres + Auth + Storage
instead of Firebase). Every page — home, shop, product, cart, checkout,
account, our story, and the workshop admin — reads and writes real data in
real time. Follow these steps in order.

> **Updating from an earlier copy?** `schema.sql` is safe to re-run in
> full any time — every statement uses `if not exists` / `drop policy if
> exists` guards, so re-running it just adds what's missing (Leadership
> table, Settings table, order logistics columns) without touching your
> existing data. Just paste the whole file into SQL Editor and run again.

## 1. Create a Supabase project

1. Go to <https://supabase.com/dashboard> and create a new project (pick
   any region close to your customers).
2. Once it's ready, go to **Project Settings → API**.
3. Copy the **Project URL** and the **anon / public** key (not the
   `service_role` key — that one must never be used in browser code).
4. Open `supabase-init.js` in this folder and paste both into
   `MISTI_SUPABASE_URL` / `MISTI_SUPABASE_ANON_KEY`.

## 2. Turn on auth methods

**Authentication → Providers**:
- **Email** — enable it.
- **Anonymous Sign-Ins** — enable it (Authentication → Sign In / Providers,
  depending on dashboard version). This is what lets a shopper's cart work
  before they create an account.

**Authentication → Sign In / Up settings** — decide on **"Confirm email"**:
- **ON (default)**: more secure, but a new shopper must click a link in
  their inbox before their account is fully active — they'll see "check
  your email" after signing up.
- **OFF**: instant account activation, closer to a typical guest checkout
  flow. Turn this off if you'd rather not have that extra step.

## 3. Run the schema

Go to **SQL Editor → New query**, paste in the entire contents of
`schema.sql`, and click **Run**. This one script creates every table, all
Row Level Security policies, the two storage buckets (`product-images`,
`artisan-images`) with their access policies, and turns on realtime for
the tables that need live updates. Nothing else to configure.

## 4. Create your admin account (do this before sharing the site!)

The catalog (products/artisans) seeds itself automatically **the first
time an admin loads the dashboard** — so sign in as admin once before
regular shoppers visit, or they'll see an empty shop.

1. Open `account.html` and use **Create Account** to sign up with your own
   email (or use `admin.html`'s sign-in form — either works).
   - If "Confirm email" is ON, check your inbox and click the link first.
2. In the Supabase dashboard, go to **Authentication → Users**, find your
   account, and copy its **User UID**.
3. Go to **Table Editor → admins → Insert row**. Set `uid` to the UID you
   copied. The `email` column is optional (just for your own reference).
4. Open `admin.html` and sign in with the same account. You should see the
   full dashboard, and your starter catalog (12 products, 2 artisans) gets
   created automatically.

Repeat step 3 for any teammate's UID to give them admin access too. There's
no self-serve "make me an admin" button on purpose.

## 5. Put the site online

Any static host works (Netlify, Vercel, Firebase Hosting, S3, GitHub
Pages, etc.) — this is plain HTML/CSS/JS, no build step, no server.

## What's new in this update

- **Leadership section** (Our Story page) — manage Founder/CEO cards from
  Admin → Leadership, same pattern as Artisan Profiles (add/edit, photo
  upload, live on the storefront instantly).
- **Order logistics** — Admin → Customer Orders → "Set"/"Edit" under the
  Logistics column lets you attach a transporter name + tracking ID to
  any order. It shows up for the customer in Account → Order History and
  Live Tracking automatically.
- **Store Settings** (Admin → Settings) — shipping fee, store contact
  email/phone, and a default transporter name, all editable without
  touching code. Checkout now reads the shipping fee from here live.
- **Invoices** — every order gets a "Download Invoice" button (on the
  checkout confirmation screen and on each past order in Account → Order
  History), generating a PDF client-side via jsPDF (loaded from a CDN,
  no extra setup needed).

## What's real vs. simplified

- **Payments aren't processed.** Checkout collects card/UPI details for
  the flow but never charges a card — no payment gateway is wired in.
- **One saved address per account**, not a full multi-address book.
- **Order tracking** shows real status (Pending → Processing → Shipped →
  Delivered) but no carrier-level tracking events.
- **Guest carts** use an anonymous Supabase session tied to that browser.
  If someone checks out without an account, the order still saves, but
  they'll only see it again under "Order History" if they sign up in that
  same browser before clearing site data.
- `product.html` still shows one fixed product rather than a `?id=` page
  per product — a pre-existing template limitation, unrelated to the
  backend.
- Signing up may require an email-confirmation click depending on your
  step 2 setting — see above.

## Troubleshooting

- **"Supabase config is still a placeholder" in the console** — step 1
  isn't done yet.
- **Products/pages stay empty** — an admin needs to load the dashboard
  once first (step 4).
- **`new row violates row-level security policy`** — schema.sql wasn't run
  (step 3), or you're trying to write to a table your account isn't
  allowed to (e.g. editing products without being in `admins`).
- **Realtime updates don't show up without a refresh** — check
  **Database → Replication** in the dashboard and confirm the table is
  listed under `supabase_realtime`; schema.sql adds this automatically,
  but a project created before running it may need a manual toggle there.
- **Stuck after signup on "check your email"** — that's expected if
  "Confirm email" is on (step 2). Turn it off for instant activation.
- **"email rate limit exceeded" when creating an account** — Supabase's
  built-in email service (the default, before you add custom SMTP) only
  sends a handful of confirmation emails per hour for the whole project,
  not per user. Repeated signups/testing burns through that fast. Fixes:
  turn off **"Confirm email"** (step 2) so signup never sends an email, or
  add your own SMTP provider under **Project Settings → Auth → SMTP
  Settings** to lift the limit. Either way, just wait a few minutes and
  retry in the meantime.
