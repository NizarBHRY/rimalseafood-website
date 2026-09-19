-- ============================================================
-- RIMAL SEAFOOD — ONLINE PAYMENT (STRIPE) SETUP
-- ============================================================
-- Paste this into Supabase > SQL Editor > New Query and press RUN.
-- You only need to do this once. It adds one column to the orders
-- table so the site can tell which orders were paid online.
-- ============================================================

alter table public.orders
  add column if not exists payment_status text not null default 'unpaid';

-- ============================================================
-- DONE. Next: follow STRIPE-SETUP-GUIDE.txt in this same folder.
-- ============================================================
