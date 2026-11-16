-- CARTOMUX database update: run this whole file ONCE in the Supabase SQL Editor (it is safe to run again).
-- It contains, in order:
--   1. Fix: deleting a chat message
--   2. Fix: posting an accommodation listing
--   3. Ads (local vendor ads, counting, images)
--   4. Paid self-serve ads (prices, orders, rules)


-- ====================================================================
-- PART 1: Fix: deleting a chat message  (from cartomux-fix-message-delete.sql)
-- ====================================================================
-- Fix: deleting a sent chat message failed with
--   new row for relation "messages" violates check constraint "messages_body_length_check"
--
-- Why: delete_message() blanks the text of a deleted message (body = '') and sets deleted_at,
-- but the length rule required every message to have text or an attachment, so the blank
-- body of a deleted message was rejected.
--
-- Fix: a message is also allowed to have an empty body once it is marked as deleted.
-- This is looser than the old rule, so every existing message still passes.
-- Run once in the Supabase SQL Editor. Safe to run again.

alter table public.messages drop constraint if exists messages_body_length_check;
alter table public.messages add constraint messages_body_length_check
  check (
    char_length(coalesce(body, '')) <= 2000
    and (
      deleted_at is not null
      or char_length(coalesce(body, '')) > 0
      or attachment_path is not null
    )
  );


-- ====================================================================
-- PART 2: Fix: posting an accommodation listing  (from cartomux-fix-accommodation-category.sql)
-- ====================================================================
-- Fix: posting an apartment/accommodation listing failed ("Choose a valid category").
-- Why: the listings table only allowed six product categories, and 'Accommodation' was not one of them.
-- The Sell page already sets the category to 'Accommodation' automatically for accommodation listings.
-- Run once in the Supabase SQL Editor. Safe to run again. Existing listings are not affected.

alter table public.listings drop constraint if exists listings_category_check;
alter table public.listings add constraint listings_category_check
  check (category = any (array['Phones & Gadgets'::text,'Laptops'::text,'Fashion'::text,'Books'::text,'Gaming'::text,'Services'::text,'Accommodation'::text]));


-- ====================================================================
-- PART 3: Ads (local vendor ads, counting, images)  (from campora-ads.sql)
-- ====================================================================
-- CAMPORA advertising: local vendor ads with view/click counts.
-- Run once in the Supabase SQL Editor. Safe to run again.

-- 1. Ads --------------------------------------------------------------------
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  advertiser text not null check (char_length(advertiser) between 2 and 80),
  title text not null check (char_length(title) between 3 and 80),
  body text check (body is null or char_length(body) <= 200),
  image_url text,
  link_url text not null check (link_url ~* '^https://'),
  cta_label text not null default 'Learn more' check (char_length(cta_label) between 2 and 24),
  placements text[] not null default array['marketplace']::text[]
    check (cardinality(placements) > 0 and placements <@ array['home','marketplace','product']::text[]),
  status text not null default 'active' check (status in ('active','paused')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists ads_live_idx on public.ads(status, starts_at, ends_at);

alter table public.ads enable row level security;

-- Everyone (signed in or not) can read ads that are live right now.
drop policy if exists "Live ads are public" on public.ads;
create policy "Live ads are public" on public.ads for select to anon, authenticated
  using (status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now()));

-- Admins can see and manage every ad.
drop policy if exists "Admins manage ads" on public.ads;
create policy "Admins manage ads" on public.ads for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- 2. View / click counts ------------------------------------------------------
create table if not exists public.ad_events (
  id bigint generated always as identity primary key,
  ad_id uuid not null references public.ads(id) on delete cascade,
  event_type text not null check (event_type in ('view','click')),
  created_at timestamptz not null default now()
);
create index if not exists ad_events_ad_idx on public.ad_events(ad_id, event_type, created_at desc);

-- No direct access for anyone: events are written only through record_ad_event()
-- and read only through ad_stats() (admins).
alter table public.ad_events enable row level security;

create or replace function public.record_ad_event(p_ad_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event not in ('view','click') then return; end if;
  insert into public.ad_events (ad_id, event_type)
  select a.id, p_event
  from public.ads a
  where a.id = p_ad_id
    and a.status = 'active'
    and a.starts_at <= now()
    and (a.ends_at is null or a.ends_at > now());
end;
$$;
revoke all on function public.record_ad_event(uuid, text) from public;
grant execute on function public.record_ad_event(uuid, text) to anon, authenticated;

create or replace function public.ad_stats()
returns table (ad_id uuid, views bigint, clicks bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.ad_id,
         count(*) filter (where e.event_type = 'view') as views,
         count(*) filter (where e.event_type = 'click') as clicks
  from public.ad_events e
  where exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  group by e.ad_id;
$$;
revoke all on function public.ad_stats() from public;
grant execute on function public.ad_stats() to authenticated;

-- 3. Ad images (public bucket, only admins can upload) -------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-images', 'ad-images', true, 2097152, array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ad_images_public_read on storage.objects;
drop policy if exists ad_images_admin_insert on storage.objects;
drop policy if exists ad_images_admin_update on storage.objects;
drop policy if exists ad_images_admin_delete on storage.objects;

create policy ad_images_public_read on storage.objects for select to public
  using (bucket_id = 'ad-images');
create policy ad_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-images' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy ad_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'ad-images' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (bucket_id = 'ad-images' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy ad_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ad-images' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));


-- ====================================================================
-- PART 4: Paid self-serve ads (prices, orders, rules)  (from cartomux-paid-ads.sql)
-- ====================================================================
-- CARTOMUX paid, self-serve advertising.
-- Run AFTER supabase/campora-ads.sql, once, in the Supabase SQL Editor. Safe to run again.
--
-- How it works
--   * Only verified accounts (approved + paid/waived verification) can book ads.
--   * Prices are set by an admin per page, per day, in the new admin panel. Nothing is for sale
--     until an admin sets prices and switches bookings on (they start OFF).
--   * Orders are created and confirmed only by the server (service role) after Paystack confirms payment.
--   * Paid ads run automatically for exactly the days paid. No manual approval step.
--   * An admin can remove any ad at any time (status 'removed' with a reason).
--   * If an advertiser stops being verified, their paid ads stop showing automatically.

-- 1. Settings, prices and discounts -------------------------------------------
create table if not exists public.ad_settings (
  id int primary key default 1 check (id = 1),
  bookings_open boolean not null default false,
  min_days int not null default 3 check (min_days >= 1),
  max_days int not null default 30 check (max_days >= min_days),
  max_advance_days int not null default 60 check (max_advance_days >= 0)
);
insert into public.ad_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.ad_prices (
  placement text primary key check (placement in ('home','marketplace','product')),
  price_per_day_kobo int not null default 0 check (price_per_day_kobo >= 0),
  max_concurrent int not null default 5 check (max_concurrent >= 1),
  enabled boolean not null default false
);
insert into public.ad_prices (placement) values ('home'),('marketplace'),('product') on conflict (placement) do nothing;

-- Longer bookings can earn a discount: the best tier whose min_days the booking reaches.
create table if not exists public.ad_discounts (
  min_days int primary key check (min_days >= 2),
  percent int not null check (percent between 1 and 90)
);

alter table public.ad_settings enable row level security;
alter table public.ad_prices enable row level security;
alter table public.ad_discounts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ad_settings','ad_prices','ad_discounts'] loop
    execute format('drop policy if exists "%1$s readable" on public.%1$s', t);
    execute format('create policy "%1$s readable" on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "%1$s admin write" on public.%1$s', t);
    execute format($p$create policy "%1$s admin write" on public.%1$s for all to authenticated
      using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
      with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))$p$, t);
  end loop;
end $$;

-- 2. Ads: owner, source, removal ---------------------------------------------
alter table public.ads add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.ads add column if not exists source text not null default 'admin';
alter table public.ads add column if not exists removed_reason text;
alter table public.ads drop constraint if exists ads_source_check;
alter table public.ads add constraint ads_source_check check (source in ('admin','self'));
alter table public.ads drop constraint if exists ads_status_check;
alter table public.ads add constraint ads_status_check check (status in ('draft','active','paused','removed'));
create index if not exists ads_owner_idx on public.ads(owner_id);

-- Direct reads of the table now only expose admin-created ads. Self-serve ads are served
-- through live_ads() below, which also checks the paid window and the owner's verification.
drop policy if exists "Live ads are public" on public.ads;
create policy "Live ads are public" on public.ads for select to anon, authenticated
  using (source = 'admin' and status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now()));

drop policy if exists "Owners read their ads" on public.ads;
create policy "Owners read their ads" on public.ads for select to authenticated
  using (owner_id = (select auth.uid()));

-- 3. Orders ----------------------------------------------------------------------
create table if not exists public.ad_orders (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads(id) on delete restrict,
  owner_id uuid not null references public.profiles(id),
  placements text[] not null check (cardinality(placements) > 0 and placements <@ array['home','marketplace','product']::text[]),
  days int not null check (days >= 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  subtotal_kobo int not null check (subtotal_kobo > 0),
  discount_percent int not null default 0,
  amount_kobo int not null check (amount_kobo > 0),
  price_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  payment_reference text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists ad_orders_ad_idx on public.ad_orders(ad_id, status);
create index if not exists ad_orders_window_idx on public.ad_orders(status, starts_at, ends_at);
create index if not exists ad_orders_owner_idx on public.ad_orders(owner_id, created_at desc);

alter table public.ad_orders enable row level security;
-- Advertisers read their own orders; admins read all. Nobody writes directly: the server
-- (service role) creates and confirms orders after checking the payment with Paystack.
drop policy if exists "Owners read their orders" on public.ad_orders;
create policy "Owners read their orders" on public.ad_orders for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists "Admins read orders" on public.ad_orders;
create policy "Admins read orders" on public.ad_orders for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists "Admins update orders" on public.ad_orders;
create policy "Admins update orders" on public.ad_orders for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- 4. What is live right now -----------------------------------------------------
create or replace function public.ad_is_live(p_ad_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.ads a
    where a.id = p_ad_id and a.status = 'active' and (
      (a.source = 'admin' and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now()))
      or (a.source = 'self'
          and exists (select 1 from public.ad_orders o where o.ad_id = a.id and o.status = 'paid' and o.starts_at <= now() and o.ends_at > now())
          and exists (select 1 from public.student_verifications v where v.user_id = a.owner_id and v.status = 'approved' and v.payment_status in ('paid','waived')))
    )
  );
$$;
revoke all on function public.ad_is_live(uuid) from public;
grant execute on function public.ad_is_live(uuid) to anon, authenticated;

create or replace function public.live_ads(p_placement text)
returns table (id uuid, advertiser text, title text, body text, image_url text, link_url text, cta_label text,
               placements text[], status text, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select a.id, a.advertiser, a.title, a.body, a.image_url, a.link_url, a.cta_label, a.placements, a.status, a.starts_at, a.ends_at
  from public.ads a
  where p_placement in ('home','marketplace','product')
    and a.status = 'active'
    and (
      (a.source = 'admin' and p_placement = any (a.placements) and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now()))
      or (a.source = 'self'
          and exists (select 1 from public.ad_orders o where o.ad_id = a.id and o.status = 'paid' and o.starts_at <= now() and o.ends_at > now() and p_placement = any (o.placements))
          and exists (select 1 from public.student_verifications v where v.user_id = a.owner_id and v.status = 'approved' and v.payment_status in ('paid','waived')))
    );
$$;
revoke all on function public.live_ads(text) from public;
grant execute on function public.live_ads(text) to anon, authenticated;

-- View/click counting now uses the same "is it live" rule.
create or replace function public.record_ad_event(p_ad_id uuid, p_event text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_event not in ('view','click') then return; end if;
  if not public.ad_is_live(p_ad_id) then return; end if;
  insert into public.ad_events (ad_id, event_type) values (p_ad_id, p_event);
end;
$$;
revoke all on function public.record_ad_event(uuid, text) from public;
grant execute on function public.record_ad_event(uuid, text) to anon, authenticated;

-- 5. Capacity and advertiser stats ---------------------------------------------------
-- How many paid (or recently started) bookings overlap the requested window, per page.
create or replace function public.ad_availability(p_placements text[], p_start timestamptz, p_end timestamptz)
returns table (placement text, used int, capacity int)
language sql stable security definer set search_path = public
as $$
  select p.placement,
         (select count(*)::int from public.ad_orders o
           where p.placement = any (o.placements)
             and o.starts_at < p_end and o.ends_at > p_start
             and (o.status = 'paid' or (o.status = 'pending' and o.created_at > now() - interval '30 minutes'))) as used,
         p.max_concurrent as capacity
  from public.ad_prices p
  where p.placement = any (p_placements);
$$;
revoke all on function public.ad_availability(text[], timestamptz, timestamptz) from public;
grant execute on function public.ad_availability(text[], timestamptz, timestamptz) to authenticated;

create or replace function public.my_ad_stats()
returns table (ad_id uuid, views bigint, clicks bigint)
language sql stable security definer set search_path = public
as $$
  select a.id,
         count(*) filter (where e.event_type = 'view'),
         count(*) filter (where e.event_type = 'click')
  from public.ads a
  left join public.ad_events e on e.ad_id = a.id
  where a.owner_id = (select auth.uid())
  group by a.id;
$$;
revoke all on function public.my_ad_stats() from public;
grant execute on function public.my_ad_stats() to authenticated;

-- 6. Ad images: the server uploads advertiser images; the bucket stays public-read, admin-write. --
-- (No change needed: advertiser uploads go through the server using the service role.)

-- The server (service role) calls this when checking capacity for a booking.
grant execute on function public.ad_availability(text[], timestamptz, timestamptz) to service_role;

