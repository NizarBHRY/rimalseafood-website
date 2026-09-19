-- ============================================================
-- RIMAL SEAFOOD — DELIVERY OPTION SETUP
-- ============================================================
-- Paste this into Supabase > SQL Editor > New Query and press RUN.
-- You only need to do this once. It adds the columns needed for
-- the "Delivery" option in the cart (address, delivery fee, and
-- whether an order is Pickup or Delivery).
-- ============================================================

alter table public.orders
  add column if not exists fulfillment_type text not null default 'pickup';

alter table public.orders
  add column if not exists delivery_address text;

alter table public.orders
  add column if not exists delivery_fee numeric(10,2) not null default 0;

alter table public.orders
  add column if not exists delivery_distance_miles numeric(6,1);

-- ============================================================
-- DONE. Delivery orders will now show the address and a
-- "Delivery" tag in the Manager Dashboard's order list.
-- ============================================================
