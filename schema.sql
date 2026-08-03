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
  img text
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
    raise exception 'Only status may be updated on customer_orders';
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

