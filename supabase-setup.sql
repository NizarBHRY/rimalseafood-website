-- ============================================================
-- RIMAL SEAFOOD — DATABASE SETUP
-- ============================================================
-- Paste this ENTIRE file into Supabase > SQL Editor > New Query
-- and press RUN. You only ever need to do this once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------

-- Every order placed from the website lands here.
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  customer_name text,
  phone         text,
  table_number  text,
  items         jsonb not null,
  subtotal      numeric(10,2) not null default 0,
  discount      numeric(10,2) not null default 0,
  tax           numeric(10,2) not null default 0,
  total         numeric(10,2) not null default 0,
  status        text not null default 'Processing',
  payment_method text not null default 'cash',
  payment_status text not null default 'unpaid'
);

-- Add newer checkout fields when this script is run against an existing table.
alter table public.orders add column if not exists payment_method text not null default 'cash';
alter table public.orders add column if not exists payment_status text not null default 'unpaid';

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx     on public.orders (status);


-- Customer rewards accounts, keyed by phone number.
create table if not exists public.rewards_accounts (
  phone                text primary key,
  name                 text,
  visits               integer       not null default 0,
  cycle_spend          numeric(10,2) not null default 0,
  reward_balance       numeric(10,2) not null default 0,
  rewards_earned_total numeric(10,2) not null default 0,
  updated_at           timestamptz   not null default now()
);

-- Purchases counted toward the next reward (resets every 5).
alter table public.rewards_accounts add column if not exists cycle_purchases integer not null default 0;
-- Free gift platters earned but not yet claimed, and lifetime total earned.
alter table public.rewards_accounts add column if not exists platters_ready integer not null default 0;
alter table public.rewards_accounts add column if not exists platters_earned_total integer not null default 0;


-- Fish market stock levels.
create table if not exists public.inventory (
  item_name  text primary key,
  stock      numeric(10,2) not null default 20,
  updated_at timestamptz   not null default now()
);


-- ------------------------------------------------------------
-- 2. SECURITY (Row Level Security)
-- ------------------------------------------------------------
-- The website uses a public "anon" key that anyone can read from
-- the page source. These rules make sure that key can ONLY do
-- safe things: place an order, check inventory, look up its own
-- rewards. Reading the full order list or customer list requires
-- a manager login.

alter table public.orders           enable row level security;
alter table public.rewards_accounts enable row level security;
alter table public.inventory        enable row level security;

-- ORDERS ---------------------------------------------------
-- Anyone may place an order.
drop policy if exists "anyone can place an order" on public.orders;
create policy "anyone can place an order"
  on public.orders for insert
  to anon, authenticated
  with check (true);

-- Only a signed-in manager may read orders (protects customer
-- names and phone numbers from the public).
drop policy if exists "managers read orders" on public.orders;
create policy "managers read orders"
  on public.orders for select
  to authenticated
  using (true);

-- Only a signed-in manager may change status / assign a table.
drop policy if exists "managers update orders" on public.orders;
create policy "managers update orders"
  on public.orders for update
  to authenticated
  using (true) with check (true);

-- Only a signed-in manager may delete orders (the dashboard's
-- "Clear All Sales Data" button).
drop policy if exists "managers delete orders" on public.orders;
create policy "managers delete orders"
  on public.orders for delete
  to authenticated
  using (true);

-- INVENTORY ------------------------------------------------
-- Everyone can read stock (so "Sold Out" shows on the website).
drop policy if exists "anyone reads inventory" on public.inventory;
create policy "anyone reads inventory"
  on public.inventory for select
  to anon, authenticated
  using (true);

-- Only a manager can change stock levels by hand.
drop policy if exists "managers write inventory" on public.inventory;
create policy "managers write inventory"
  on public.inventory for all
  to authenticated
  using (true) with check (true);

-- REWARDS --------------------------------------------------
-- No direct public access at all. Customers interact with
-- rewards only through the safe functions defined below,
-- which never expose the full customer list.
-- Only a signed-in manager may erase rewards accounts (used with
-- "Clear All Sales Data" when wiping test data).
drop policy if exists "managers delete accounts" on public.rewards_accounts;
create policy "managers delete accounts"
  on public.rewards_accounts for delete
  to authenticated
  using (true);

drop policy if exists "managers read accounts" on public.rewards_accounts;
create policy "managers read accounts"
  on public.rewards_accounts for select
  to authenticated
  using (true);


-- ------------------------------------------------------------
-- 3. SAFE REWARDS FUNCTIONS
-- ------------------------------------------------------------
-- These run with elevated rights but only do one specific job,
-- so the public key can use them without exposing everything.

-- Phone numbers are compared by their last 10 digits, so
-- "(347) 497-4002", "3474974002" and "13474974002" are the same customer.
create or replace function public.norm_phone(p text)
returns text
language sql
immutable
as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10);
$$;

-- Adds one purchase to a customer's rewards account (creating it if
-- new) and grants a free gift platter for every 5 purchases.
-- NOT callable from the website: it is only run by credit_order_rewards
-- below, when an order is marked paid.
-- (Return types changed, so the old versions must be dropped first.)
drop function if exists public.record_visit(text, text, numeric);
drop function if exists public.get_rewards(text);
drop function if exists public.redeem_rewards(text);
drop function if exists public.get_my_order_history(text, int);

create or replace function public.record_visit(
  p_phone text,
  p_name  text,
  p_spend numeric
)
returns table (platters_ready integer, cycle_purchases integer, earned integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_acct   public.rewards_accounts%rowtype;
  v_earned integer := 0;
  v_key    text;
begin
  if length(public.norm_phone(p_phone)) = 0 then
    return;
  end if;

  select a.phone into v_key
    from public.rewards_accounts a
   where public.norm_phone(a.phone) = public.norm_phone(p_phone)
   limit 1;

  if v_key is null then
    v_key := public.norm_phone(p_phone);
    insert into public.rewards_accounts (phone, name)
    values (v_key, nullif(trim(coalesce(p_name, '')), ''))
    on conflict (phone) do nothing;
  end if;

  update public.rewards_accounts
     set name        = coalesce(nullif(trim(coalesce(p_name, '')), ''), name),
         visits      = visits + 1,
         cycle_spend = cycle_spend + greatest(p_spend, 0),
         cycle_purchases = cycle_purchases + 1,
         updated_at  = now()
   where phone = v_key
  returning * into v_acct;

  while v_acct.cycle_purchases >= 5 loop
    update public.rewards_accounts
       set cycle_purchases     = cycle_purchases - 5,
           platters_ready      = platters_ready + 1,
           platters_earned_total = platters_earned_total + 1,
           updated_at          = now()
     where phone = v_key
    returning * into v_acct;
    v_earned := v_earned + 1;
  end loop;

  return query select v_acct.platters_ready, v_acct.cycle_purchases, v_earned;
end;
$$;

-- Lets a customer look up ONLY their own account by phone.
create or replace function public.get_rewards(p_phone text)
returns table (name text, visits integer, cycle_purchases integer, platters_ready integer)
language sql
security definer
set search_path = public
as $$
  select a.name, a.visits, a.cycle_purchases, a.platters_ready
    from public.rewards_accounts a
   where public.norm_phone(a.phone) = public.norm_phone(p_phone);
$$;

-- Lets a customer see ONLY their own past orders (not anyone else's),
-- including whether each one has been paid (paid orders count toward
-- their free gift platter).
create or replace function public.get_my_order_history(p_phone text, p_limit int default 10)
returns table (id uuid, created_at timestamptz, items jsonb, total numeric, payment_status text)
language sql
security definer
set search_path = public
as $$
  select o.id, o.created_at, o.items, o.total, o.payment_status
    from public.orders o
   where length(public.norm_phone(p_phone)) > 0
     and public.norm_phone(o.phone) = public.norm_phone(p_phone)
   order by o.created_at desc
   limit greatest(p_limit, 1);
$$;

-- Called when an order is marked PAID (by the manager for cash, or by the
-- Stripe webhook for cards). Adds that purchase to the customer's rewards
-- account, exactly once per order, using the phone number on the order.
alter table public.orders add column if not exists rewards_credited boolean not null default false;

create or replace function public.credit_order_rewards(p_order_id uuid)
returns table (platters_ready integer, cycle_purchases integer, earned integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found
     or v_order.payment_status <> 'paid'
     or v_order.rewards_credited
     or length(public.norm_phone(v_order.phone)) = 0 then
    return;
  end if;

  update public.orders set rewards_credited = true where id = p_order_id;

  return query
    select r.platters_ready, r.cycle_purchases, r.earned
      from public.record_visit(v_order.phone, v_order.customer_name, v_order.total) r;
end;
$$;

-- Claims ONE free gift platter. Returns 1 if a platter was claimed,
-- 0 if the customer had none waiting.
create or replace function public.redeem_rewards(p_phone text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rewards_accounts
     set platters_ready = platters_ready - 1,
         updated_at     = now()
   where public.norm_phone(phone) = public.norm_phone(p_phone) and platters_ready > 0;

  if found then
    return 1;
  end if;
  return 0;
end;
$$;

-- Reduces stock when fish market items are sold.
create or replace function public.decrement_stock(p_item text, p_qty numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
begin
  insert into public.inventory (item_name, stock)
  values (p_item, 20)
  on conflict (item_name) do nothing;

  update public.inventory
     set stock      = greatest(0, stock - greatest(p_qty, 0)),
         updated_at = now()
   where item_name = p_item
  returning stock into v_stock;

  return v_stock;
end;
$$;

-- record_visit and credit_order_rewards must NOT be callable by the public
-- website key (otherwise anyone could give themselves purchases). Only a
-- signed-in manager and the server-side Stripe webhook may run them.
revoke execute on function public.record_visit(text, text, numeric)  from public, anon, authenticated;
revoke execute on function public.credit_order_rewards(uuid)         from public, anon;
grant  execute on function public.credit_order_rewards(uuid)         to authenticated, service_role;
grant execute on function public.get_rewards(text)                   to anon, authenticated;
grant execute on function public.redeem_rewards(text)                to anon, authenticated;
grant execute on function public.decrement_stock(text, numeric)      to anon, authenticated;
grant execute on function public.get_my_order_history(text, int)     to anon, authenticated;


-- ------------------------------------------------------------
-- 4. LIVE UPDATES
-- ------------------------------------------------------------
-- Lets the Manager Dashboard receive new orders instantly
-- instead of waiting for a refresh.

-- (Wrapped so the script can be run again safely.)
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then
  null;
end $$;


-- ------------------------------------------------------------
-- 5. MENU & FISH MARKET ITEMS ADDED FROM THE MANAGER DASHBOARD
-- ------------------------------------------------------------
-- Items the manager adds appear on the website next to the ones
-- already built into the page. "category" says where it shows up
-- (menu_drinks, menu_salads, market_fish, ...). "options" holds
-- size choices such as [{"label":"Small","price":10},{"label":"Large","price":14}].

create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  name        text          not null,
  description text,
  category    text          not null,
  price       numeric(10,2) not null,
  unit        text,
  options     jsonb,
  image_url   text,
  created_at  timestamptz   not null default now()
);

alter table public.menu_items enable row level security;

-- Everyone can see the items (it is the public menu).
drop policy if exists "anyone reads menu items" on public.menu_items;
create policy "anyone reads menu items"
  on public.menu_items for select
  to anon, authenticated
  using (true);

-- Only a signed-in manager can add, change or remove items.
drop policy if exists "managers write menu items" on public.menu_items;
create policy "managers write menu items"
  on public.menu_items for all
  to authenticated
  using (true) with check (true);

-- Changes the manager makes to items that are built into the page
-- (a new price, a fixed description, a new photo, or removing the item).
-- item_key is "<section>|<original item name>". image_url: null = keep the
-- original photo, '' = no photo. removed = hidden from the website.
create table if not exists public.menu_overrides (
  item_key    text primary key,
  name        text,
  description text,
  price       numeric(10,2),
  options     jsonb,
  image_url   text,
  removed     boolean     not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.menu_overrides enable row level security;

drop policy if exists "anyone reads menu overrides" on public.menu_overrides;
create policy "anyone reads menu overrides"
  on public.menu_overrides for select
  to anon, authenticated
  using (true);

drop policy if exists "managers write menu overrides" on public.menu_overrides;
create policy "managers write menu overrides"
  on public.menu_overrides for all
  to authenticated
  using (true) with check (true);

-- Website photos the manager replaced, removed or added (Home, About,
-- Visit, Logo and Gallery). photo_key is a fixed name for the pictures
-- built into the page (home_hero, about, visit_bg, logo, gallery-1 ...)
-- or "gallery-new-..." for gallery photos the manager added.
-- image_url: the replacement photo. removed: hidden from the website.
create table if not exists public.site_photos (
  photo_key  text primary key,
  image_url  text,
  removed    boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table public.site_photos enable row level security;

drop policy if exists "anyone reads site photos" on public.site_photos;
create policy "anyone reads site photos"
  on public.site_photos for select
  to anon, authenticated
  using (true);

drop policy if exists "managers write site photos" on public.site_photos;
create policy "managers write site photos"
  on public.site_photos for all
  to authenticated
  using (true) with check (true);

-- Photo storage: a public "menu-photos" folder. Anyone can view the
-- photos; only a signed-in manager can upload or delete them.
-- (Wrapped so that if Supabase refuses any storage step, the rest of
-- this script still completes. Check Storage afterward: a public bucket
-- named "menu-photos" must exist.)
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('menu-photos', 'menu-photos', true)
  on conflict (id) do update set public = true;

  drop policy if exists "anyone views menu photos" on storage.objects;
  create policy "anyone views menu photos"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'menu-photos');

  drop policy if exists "managers upload menu photos" on storage.objects;
  create policy "managers upload menu photos"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'menu-photos');

  drop policy if exists "managers delete menu photos" on storage.objects;
  create policy "managers delete menu photos"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'menu-photos');
exception when others then
  raise notice 'Photo storage was NOT set up automatically (%). Create a public bucket named menu-photos in Supabase > Storage.', sqlerrm;
end $$;


-- ============================================================
-- DONE. Next: copy your Project URL and anon key from
-- Supabase > Project Settings > API into config.js
-- ============================================================
