-- ============================================================
-- mistiCRAFT — Supabase schema
-- Run once: Dashboard > SQL Editor > New query > paste all > Run
-- ============================================================

-- ---------- Tables ----------
create table if not exists products (
  id text primary key,
  name text not null,
  category text,
  technique text,
  tagline text,
  price numeric not null default 0,
  mrp numeric not null default 0,
  stock integer not null default 0,
  status text not null default 'active',
  featured boolean not null default false,
  img text,
  images text[] not null default '{}',
  image_fit text not null default 'cover'
);

create table if not exists artisans (
  id text primary key,
  name text not null,
  role text,
  quote text,
  tags text[] default '{}',
  img text
);

-- Internal workshop production board — NOT customer purchases.
create table if not exists orders (
  id text primary key,
  unit text,
  status text not null default 'Pending',
  amount numeric not null default 0
);

-- Real customer purchases created at checkout.
create table if not exists customer_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  uid uuid not null references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  shipping numeric not null default 0,
  total numeric not null default 0,
  contact jsonb default '{}',
  address jsonb default '{}',
  payment jsonb default '{}',
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists carts (
  uid uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists wishlists (
  uid uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  uid uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  email text,
  address jsonb
);

-- Admin allowlist. No client write path on purpose — add rows from the
-- Table Editor only. See SETUP-SUPABASE.md.
create table if not exists admins (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text
);

-- ---------- Helper: is the current request from an admin? ----------
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from admins where uid = auth.uid());
$$;

-- ---------- Row Level Security ----------
alter table products enable row level security;
alter table artisans enable row level security;
alter table orders enable row level security;
alter table customer_orders enable row level security;
alter table carts enable row level security;
alter table wishlists enable row level security;
alter table profiles enable row level security;
alter table admins enable row level security;

drop policy if exists "products public read" on products;
create policy "products public read" on products for select using (true);
drop policy if exists "products admin write" on products;
create policy "products admin write" on products for all using (is_admin()) with check (is_admin());

drop policy if exists "artisans public read" on artisans;
create policy "artisans public read" on artisans for select using (true);
drop policy if exists "artisans admin write" on artisans;
create policy "artisans admin write" on artisans for all using (is_admin()) with check (is_admin());

drop policy if exists "orders admin only" on orders;
create policy "orders admin only" on orders for all using (is_admin()) with check (is_admin());

drop policy if exists "customer_orders insert own" on customer_orders;
create policy "customer_orders insert own" on customer_orders for insert with check (uid = auth.uid());
drop policy if exists "customer_orders read own or admin" on customer_orders;
create policy "customer_orders read own or admin" on customer_orders for select using (uid = auth.uid() or is_admin());
drop policy if exists "customer_orders admin update" on customer_orders;
create policy "customer_orders admin update" on customer_orders for update using (is_admin()) with check (is_admin());

drop policy if exists "carts owner only" on carts;
create policy "carts owner only" on carts for all using (uid = auth.uid()) with check (uid = auth.uid());

drop policy if exists "wishlists owner only" on wishlists;
create policy "wishlists owner only" on wishlists for all using (uid = auth.uid()) with check (uid = auth.uid());

drop policy if exists "profiles owner only" on profiles;
create policy "profiles owner only" on profiles for all using (uid = auth.uid()) with check (uid = auth.uid());

drop policy if exists "admins self read" on admins;
create policy "admins self read" on admins for select using (uid = auth.uid());
-- No insert/update/delete policy -> admins table is never writable from
-- client code, only from the Table Editor / service role.

-- Enforce: once a customer_order exists, only its status can change
-- (mirrors what the app's own UPDATE query does, at the DB level too).
create or replace function customer_orders_only_status_changes()
returns trigger
language plpgsql
as $$
begin
  if (new.order_number, new.uid, new.items, new.subtotal, new.shipping, new.total,
      new.contact, new.address, new.payment, new.created_at)
     is distinct from
     (old.order_number, old.uid, old.items, old.subtotal, old.shipping, old.total,
      old.contact, old.address, old.payment, old.created_at) then
    raise exception 'Only status, transporter, and tracking_id may be updated on customer_orders';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_customer_orders_status_only on customer_orders;
create trigger enforce_customer_orders_status_only
before update on customer_orders
for each row execute function customer_orders_only_status_changes();

-- ---------- Realtime: broadcast changes on these tables ----------
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table artisans;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table customer_orders;
alter publication supabase_realtime add table carts;
alter publication supabase_realtime add table wishlists;

-- ---------- Storage buckets (product/artisan photos) ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('artisan-images', 'artisan-images', true)
on conflict (id) do nothing;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects
for select using (bucket_id = 'product-images');
drop policy if exists "product images admin insert" on storage.objects;
create policy "product images admin insert" on storage.objects
for insert with check (bucket_id = 'product-images' and is_admin());
drop policy if exists "product images admin update" on storage.objects;
create policy "product images admin update" on storage.objects
for update using (bucket_id = 'product-images' and is_admin());
drop policy if exists "product images admin delete" on storage.objects;
create policy "product images admin delete" on storage.objects
for delete using (bucket_id = 'product-images' and is_admin());

drop policy if exists "artisan images public read" on storage.objects;
create policy "artisan images public read" on storage.objects
for select using (bucket_id = 'artisan-images');
drop policy if exists "artisan images admin insert" on storage.objects;
create policy "artisan images admin insert" on storage.objects
for insert with check (bucket_id = 'artisan-images' and is_admin());
drop policy if exists "artisan images admin update" on storage.objects;
create policy "artisan images admin update" on storage.objects
for update using (bucket_id = 'artisan-images' and is_admin());
drop policy if exists "artisan images admin delete" on storage.objects;
create policy "artisan images admin delete" on storage.objects
for delete using (bucket_id = 'artisan-images' and is_admin());

-- ============================================================
-- Added: Leadership (founder/CEO) profiles, order logistics fields,
-- and a real store-settings table (shipping fee, contact info).
-- Safe to re-run: every statement below is idempotent.
-- ============================================================

-- ---------- Leadership / founders (managed like artisans) ----------
create table if not exists founders (
  id text primary key,
  name text not null,
  role text,
  quote text,
  img text
);
alter table founders enable row level security;
drop policy if exists "founders public read" on founders;
create policy "founders public read" on founders for select using (true);
drop policy if exists "founders admin write" on founders;
create policy "founders admin write" on founders for all using (is_admin()) with check (is_admin());
alter publication supabase_realtime add table founders;

insert into storage.buckets (id, name, public)
values ('founder-images', 'founder-images', true)
on conflict (id) do nothing;

drop policy if exists "founder images public read" on storage.objects;
create policy "founder images public read" on storage.objects
for select using (bucket_id = 'founder-images');
drop policy if exists "founder images admin insert" on storage.objects;
create policy "founder images admin insert" on storage.objects
for insert with check (bucket_id = 'founder-images' and is_admin());
drop policy if exists "founder images admin update" on storage.objects;
create policy "founder images admin update" on storage.objects
for update using (bucket_id = 'founder-images' and is_admin());
drop policy if exists "founder images admin delete" on storage.objects;
create policy "founder images admin delete" on storage.objects
for delete using (bucket_id = 'founder-images' and is_admin());

-- ---------- Order logistics: transporter + tracking id ----------
-- Not part of the immutable-fields tuple in the status trigger, so
-- admins can set these the same way they update status.
alter table customer_orders add column if not exists transporter text;
alter table customer_orders add column if not exists tracking_id text;

-- ---------- UPI payment details (store owner's own VPA) ----------
-- Checkout is UPI-only: the merchant's UPI ID/payee name live in
-- settings and are turned into a upi://pay deep link + QR at checkout.
alter table settings add column if not exists upi_id text;
alter table settings add column if not exists upi_payee_name text;

-- ---------- Cleanup: drop leftover Razorpay artifacts ----------
-- Predate the UPI-only switch and were never created by this schema
-- file (added directly against the live DB by an earlier setup).
alter table customer_orders drop column if exists razorpay_order_id;
alter table customer_orders drop column if exists razorpay_payment_id;
alter table customer_orders drop column if exists payment_status;
drop table if exists pending_orders;

-- ---------- Store settings (single row) ----------
create table if not exists settings (
  id int primary key default 1,
  shipping_fee numeric not null default 99,
  store_email text,
  store_phone text,
  default_transporter text,
  constraint settings_singleton check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;
alter table settings enable row level security;
drop policy if exists "settings public read" on settings;
create policy "settings public read" on settings for select using (true);
drop policy if exists "settings admin write" on settings;
create policy "settings admin write" on settings for all using (is_admin()) with check (is_admin());
alter publication supabase_realtime add table settings;

-- ---------- Product image gallery + display style ----------
-- `img` stays the cover photo (kept in sync by the admin app);
-- `images` holds the full gallery order, `image_fit` picks how it's
-- cropped on the storefront (cover = fill/crop, contain = fit whole photo).
alter table products add column if not exists images text[] not null default '{}';
alter table products add column if not exists image_fit text not null default 'cover';

-- ---------- Shop sort rank ----------
-- A coarse priority tier admins set per product to control default
-- ("Featured") ordering in the shop grid: top < center < bottom.
alter table products add column if not exists rank text not null default 'center';
alter table products drop constraint if exists products_rank_check;
alter table products add constraint products_rank_check check (rank in ('top','center','bottom'));

-- ---------- Homepage hero: photo or video ----------
-- A plain URL; the storefront decides photo vs. video by file extension
-- (see mistiData.isVideoUrl), so no separate "type" column is needed.
alter table settings add column if not exists hero_media_url text;

-- ---------- Homepage hero: multiple photos/videos ----------
-- Ordered list of URLs the homepage hero cycles through (photo or video
-- per-item, decided by extension via mistiData.isVideoUrl). Replaces the
-- single hero_media_url column above, which is kept only so any existing
-- single URL is carried forward into the array below.
alter table settings add column if not exists hero_media text[] not null default '{}';
update settings set hero_media = array[hero_media_url]
  where hero_media_url is not null and hero_media_url <> ''
  and coalesce(array_length(hero_media, 1), 0) = 0;

-- Storage bucket for hero uploads — handleHeroMediaUpload() in admin.html
-- uploads to 'hero-media', but no bucket by that name was ever created,
-- so every hero upload failed with "Upload failed — check your connection".
insert into storage.buckets (id, name, public)
values ('hero-media', 'hero-media', true)
on conflict (id) do nothing;

drop policy if exists "hero media public read" on storage.objects;
create policy "hero media public read" on storage.objects
for select using (bucket_id = 'hero-media');
drop policy if exists "hero media admin insert" on storage.objects;
create policy "hero media admin insert" on storage.objects
for insert with check (bucket_id = 'hero-media' and is_admin());
drop policy if exists "hero media admin update" on storage.objects;
create policy "hero media admin update" on storage.objects
for update using (bucket_id = 'hero-media' and is_admin());
drop policy if exists "hero media admin delete" on storage.objects;
create policy "hero media admin delete" on storage.objects
for delete using (bucket_id = 'hero-media' and is_admin());

-- ============================================================
-- Live order tracking: a fine-grained stage timeline per customer
-- order, kept up to date two ways —
--   1. the admin status dropdown (writes a tracking_events row instead
--      of customer_orders.status directly — see mistiData.orders.updateStatus)
--   2. the delhivery-sync Edge Function (supabase/functions/delhivery-sync),
--      polled on a schedule by pg_cron below, which reads each Delhivery
--      shipment's live status via their Track API and appends events
--      the same way.
-- The customer's own no-login lookup (order number + phone/email) goes
-- through a SECURITY DEFINER function below, so tracking_events and
-- customer_orders stay locked down to admins only via RLS.
-- ============================================================

create table if not exists tracking_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references customer_orders(id) on delete cascade,
  stage text not null check (stage in ('placed','processing','shipped','out_for_delivery','delivered','cancelled')),
  note text,
  created_at timestamptz not null default now()
);
alter table tracking_events enable row level security;
-- No anon/authenticated policy on purpose — a tracking customer only
-- ever reads through track_order() below; admins keep direct access
-- for the Admin panel, and the delhivery-sync function writes with
-- the service role, which bypasses RLS entirely.
drop policy if exists "tracking_events admin all" on tracking_events;
create policy "tracking_events admin all" on tracking_events for all using (is_admin()) with check (is_admin());
alter publication supabase_realtime add table tracking_events;

-- Coarse status (shown on the Admin board and customer_orders row)
-- mirrors the latest tracking_events stage. This is the ONE place
-- that writes customer_orders.status — both the admin status dropdown
-- and delhivery-sync go through inserting a tracking_events row, and
-- this trigger keeps status in sync automatically.
create or replace function tracking_events_sync_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update customer_orders set status = case new.stage
    when 'placed' then 'Pending'
    when 'processing' then 'Processing'
    when 'shipped' then 'Shipped'
    when 'out_for_delivery' then 'Shipped'
    when 'delivered' then 'Delivered'
    when 'cancelled' then 'Cancelled'
    else status end
  where id = new.order_id;
  return new;
end;
$$;
drop trigger if exists sync_order_status_on_tracking_event on tracking_events;
create trigger sync_order_status_on_tracking_event
after insert on tracking_events
for each row execute function tracking_events_sync_order_status();

-- Every new customer order starts its timeline with a 'placed' event.
create or replace function customer_orders_seed_first_tracking_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into tracking_events (order_id, stage) values (new.id, 'placed');
  return new;
end;
$$;
drop trigger if exists seed_first_tracking_event on customer_orders;
create trigger seed_first_tracking_event
after insert on customer_orders
for each row execute function customer_orders_seed_first_tracking_event();

-- ---------- Customer-facing lookup: order number + phone or email ----------
-- Returns only what a customer needs to see their own order — never a
-- full table scan, and only when both the order number AND a contact
-- value they'd know (their own email/phone) match.
create or replace function track_order(p_order_number text, p_contact text)
returns table (
  order_number text, status text, items jsonb, subtotal numeric, shipping numeric, total numeric,
  transporter text, tracking_id text, created_at timestamptz, events jsonb
)
language sql
security definer
set search_path = public
as $$
  select o.order_number, o.status, o.items, o.subtotal, o.shipping, o.total,
         o.transporter, o.tracking_id, o.created_at,
         coalesce((select jsonb_agg(jsonb_build_object('stage', te.stage, 'note', te.note, 'created_at', te.created_at) order by te.created_at)
                   from tracking_events te where te.order_id = o.id), '[]'::jsonb) as events
  from customer_orders o
  where o.order_number = p_order_number
    and p_contact is not null and length(trim(p_contact)) > 0
    and (o.contact->>'email' = p_contact or o.contact->>'phone' = p_contact)
  limit 1;
$$;
grant execute on function track_order(text, text) to anon, authenticated;

-- ---------- Delhivery live tracking sync ----------
-- Every order shipped via Delhivery (admin sets transporter = "Delhivery"
-- plus the waybill number as tracking_id, same Shipping Logistics modal
-- as before) gets polled automatically — no manual status updates
-- needed. See supabase/functions/delhivery-sync for the actual API call;
-- this just schedules it. DELHIVERY_API_TOKEN is an Edge Function secret
-- (Dashboard > Edge Functions > delhivery-sync > Secrets), never stored
-- in the database or this file.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('delhivery-sync-job') where exists (select 1 from cron.job where jobname = 'delhivery-sync-job');

select cron.schedule(
  'delhivery-sync-job',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://pdntxosjtacqgvzavtio.supabase.co/functions/v1/delhivery-sync',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ---------- Shareable invoice links ----------
-- Storage bucket for customer invoice PDFs, generated client-side
-- (invoice.js) and uploaded so a permanent link can be shared (WhatsApp,
-- email, etc.) instead of only downloading to one device. Public bucket
-- + unguessable path (the order's own UUID as the filename) is the trust
-- model here, matching product/artisan/founder/hero media, but
-- insert/update is scoped to the order's own owner (or admin) rather
-- than admin-only, since guests and logged-in customers both need to be
-- able to generate/share their own invoice.
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

drop policy if exists "invoices public read" on storage.objects;
create policy "invoices public read" on storage.objects
for select using (bucket_id = 'invoices');

drop policy if exists "invoices owner insert" on storage.objects;
create policy "invoices owner insert" on storage.objects
for insert with check (
  bucket_id = 'invoices'
  and exists (
    select 1 from customer_orders o
    where o.id::text = split_part(storage.objects.name, '.', 1)
    and (o.uid = auth.uid() or is_admin())
  )
);

drop policy if exists "invoices owner update" on storage.objects;
create policy "invoices owner update" on storage.objects
for update using (
  bucket_id = 'invoices'
  and exists (
    select 1 from customer_orders o
    where o.id::text = split_part(storage.objects.name, '.', 1)
    and (o.uid = auth.uid() or is_admin())
  )
);


-- ---------- Delhivery auto-generated shipping labels ----------
-- Optional per-product weight, used when auto-creating a Delhivery
-- shipment; falls back to settings.default_package_weight_grams per
-- item when a product doesn't specify one.
alter table products add column if not exists weight_grams numeric;

-- Delhivery shipment-creation config: pickup_location must exactly
-- match a location already registered in the merchant's Delhivery
-- dashboard, or every create-shipment call fails. Package dimensions
-- are store-wide defaults (combining multiple products' dimensions
-- into one box size isn't practical, so only weight is summed
-- per-item; L/W/H always use these).
alter table settings add column if not exists delhivery_pickup_location text;
alter table settings add column if not exists default_package_weight_grams numeric not null default 500;
alter table settings add column if not exists default_package_length_cm numeric not null default 30;
alter table settings add column if not exists default_package_width_cm numeric not null default 25;
alter table settings add column if not exists default_package_height_cm numeric not null default 5;
