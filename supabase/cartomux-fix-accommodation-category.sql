-- Fix: posting an apartment/accommodation listing failed ("Choose a valid category").
-- Why: the listings table only allowed six product categories, and 'Accommodation' was not one of them.
-- The Sell page already sets the category to 'Accommodation' automatically for accommodation listings.
-- Run once in the Supabase SQL Editor. Safe to run again. Existing listings are not affected.

alter table public.listings drop constraint if exists listings_category_check;
alter table public.listings add constraint listings_category_check
  check (category = any (array['Phones & Gadgets'::text,'Laptops'::text,'Fashion'::text,'Books'::text,'Gaming'::text,'Services'::text,'Accommodation'::text]));
