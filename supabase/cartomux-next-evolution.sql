-- CARTOMUX Next Evolution: Trust, Discovery and Campus Experience.
-- Run once in Supabase SQL Editor after the existing CARTOMUX migrations.
-- Safe to re-run. No payment/escrow movement is introduced by this migration.

-- ---------------------------------------------------------------------------
-- Campus directory
-- ---------------------------------------------------------------------------
create table if not exists public.campus_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  state text,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists campus_directory_name_idx on public.campus_directory (lower(name));
alter table public.campus_directory enable row level security;
drop policy if exists campus_directory_public_read on public.campus_directory;
create policy campus_directory_public_read on public.campus_directory for select to anon, authenticated using (true);
drop policy if exists campus_directory_admin_write on public.campus_directory;
create policy campus_directory_admin_write on public.campus_directory for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Seed campuses already represented by listings. Human-readable slugs are derived
-- from the existing campus field; admins can later curate names and locations.
insert into public.campus_directory (name, slug)
select distinct trim(l.campus), trim(both '-' from regexp_replace(lower(trim(l.campus)), '[^a-z0-9]+', '-', 'g'))
from public.listings l
where nullif(trim(l.campus), '') is not null
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Saved searches and matching notifications
-- ---------------------------------------------------------------------------
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Saved search',
  criteria jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint saved_search_name_length check (char_length(name) between 1 and 80)
);
create index if not exists saved_searches_user_idx on public.saved_searches(user_id, created_at desc);
alter table public.saved_searches enable row level security;
drop policy if exists saved_searches_owner_all on public.saved_searches;
create policy saved_searches_owner_all on public.saved_searches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_saved_search_matches()
returns trigger language plpgsql security definer set search_path = public
as $$
declare s record; c jsonb; q text; min_price numeric; max_price numeric; campus_filter text; category_filter text; condition_filter text; listing_type_filter text; property_type_filter text;
begin
  if new.status <> 'available' then return new; end if;
  for s in select id, user_id, criteria from public.saved_searches where active = true and user_id <> new.seller_id loop
    c := coalesce(s.criteria, '{}'::jsonb);
    q := nullif(trim(c->>'q'), '');
    min_price := nullif(c->>'minPrice', '')::numeric;
    max_price := nullif(c->>'maxPrice', '')::numeric;
    campus_filter := nullif(c->>'campus', '');
    category_filter := nullif(c->>'category', '');
    condition_filter := nullif(c->>'condition', '');
    listing_type_filter := nullif(c->>'listingType', '');
    property_type_filter := nullif(c->>'propertyType', '');
    if (q is null or new.title ilike '%' || q || '%' or coalesce(new.description,'') ilike '%' || q || '%')
      and (min_price is null or new.price >= min_price)
      and (max_price is null or new.price <= max_price)
      and (campus_filter is null or new.campus ilike campus_filter)
      and (category_filter is null or new.category = category_filter)
      and (condition_filter is null or new.condition = condition_filter)
      and (listing_type_filter is null or new.listing_type = listing_type_filter)
      and (property_type_filter is null or new.property_type = property_type_filter)
    then
      insert into public.notifications(user_id, type, title, body, listing_id)
      values (s.user_id, 'saved_search', 'A new listing matches your search', left(new.title || ' is now available on CARTOMUX.', 180), new.id);
    end if;
  end loop;
  return new;
exception when invalid_text_representation then
  -- A malformed optional numeric filter must never block a seller from publishing.
  return new;
end;
$$;
drop trigger if exists trg_notify_saved_search_matches on public.listings;
create trigger trg_notify_saved_search_matches after insert on public.listings for each row execute function public.notify_saved_search_matches();

-- ---------------------------------------------------------------------------
-- Verified transaction history and seller reviews
-- ---------------------------------------------------------------------------
create table if not exists public.sale_transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  status text not null default 'awaiting_buyer' check (status in ('awaiting_buyer','confirmed','disputed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check (seller_id <> buyer_id)
);
create index if not exists sale_transactions_buyer_idx on public.sale_transactions(buyer_id, created_at desc);
create index if not exists sale_transactions_seller_idx on public.sale_transactions(seller_id, created_at desc);
create unique index if not exists sale_transactions_one_active_per_listing on public.sale_transactions(listing_id) where status = 'awaiting_buyer';
alter table public.sale_transactions enable row level security;
drop policy if exists sale_transactions_participant_read on public.sale_transactions;
create policy sale_transactions_participant_read on public.sale_transactions for select to authenticated
  using (seller_id = auth.uid() or buyer_id = auth.uid());

create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.sale_transactions(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text check (review is null or char_length(review) <= 600),
  created_at timestamptz not null default now(),
  check (seller_id <> buyer_id)
);
create index if not exists seller_reviews_seller_idx on public.seller_reviews(seller_id, created_at desc);
alter table public.seller_reviews enable row level security;
drop policy if exists seller_reviews_public_read on public.seller_reviews;
create policy seller_reviews_public_read on public.seller_reviews for select to anon, authenticated using (true);

create or replace function public.create_listing_sale(p_listing_id uuid, p_buyer_id uuid, p_conversation_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare l public.listings; c public.conversations; txid uuid;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if l.id is null or l.seller_id <> auth.uid() or l.status <> 'available' then raise exception 'This listing is not available to mark as sold'; end if;
  select * into c from public.conversations where id = p_conversation_id;
  if c.id is null or c.listing_id <> p_listing_id or c.seller_id <> auth.uid() or c.buyer_id <> p_buyer_id then raise exception 'Choose a buyer from a conversation about this listing'; end if;
  if p_buyer_id = auth.uid() then raise exception 'A seller cannot select themselves as the buyer'; end if;
  insert into public.sale_transactions(listing_id,seller_id,buyer_id,conversation_id)
  values (p_listing_id,auth.uid(),p_buyer_id,p_conversation_id) returning id into txid;
  update public.listings set status = 'sold' where id = p_listing_id;
  insert into public.notifications(user_id,type,title,body,listing_id)
  values (p_buyer_id,'sale_confirmation','Confirm your CARTOMUX purchase','The seller marked this listing as sold to you. Confirm the transaction to leave a review.',p_listing_id);
  return txid;
end;
$$;

create or replace function public.confirm_listing_sale(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare tx public.sale_transactions;
begin
  select * into tx from public.sale_transactions where id = p_transaction_id for update;
  if tx.id is null or tx.buyer_id <> auth.uid() then raise exception 'Only the selected buyer can confirm this transaction'; end if;
  if tx.status <> 'awaiting_buyer' then raise exception 'This transaction is no longer awaiting confirmation'; end if;
  update public.sale_transactions set status = 'confirmed', confirmed_at = now() where id = p_transaction_id;
  insert into public.notifications(user_id,type,title,body,listing_id)
  values (tx.seller_id,'sale_confirmed','Transaction confirmed','The buyer confirmed the transaction. Your buyer can now leave a review.',tx.listing_id);
end;
$$;

create or replace function public.submit_seller_review(p_transaction_id uuid, p_rating integer, p_review text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare tx public.sale_transactions; review_id uuid;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if p_review is not null and char_length(p_review) > 600 then raise exception 'Review is too long'; end if;
  select * into tx from public.sale_transactions where id = p_transaction_id;
  if tx.id is null or tx.buyer_id <> auth.uid() or tx.status <> 'confirmed' then raise exception 'Only the confirmed buyer can review this seller'; end if;
  insert into public.seller_reviews(transaction_id,listing_id,seller_id,buyer_id,rating,review)
  values (tx.id,tx.listing_id,tx.seller_id,tx.buyer_id,p_rating,nullif(trim(p_review),'')) returning id into review_id;
  return review_id;
end;
$$;
revoke all on function public.create_listing_sale(uuid,uuid,uuid) from public, anon;
revoke all on function public.confirm_listing_sale(uuid) from public, anon;
revoke all on function public.submit_seller_review(uuid,integer,text) from public, anon;
grant execute on function public.create_listing_sale(uuid,uuid,uuid) to authenticated;
grant execute on function public.confirm_listing_sale(uuid) to authenticated;
grant execute on function public.submit_seller_review(uuid,integer,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Accommodation viewing requests
-- ---------------------------------------------------------------------------
create table if not exists public.viewing_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  requested_for timestamptz not null,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
create index if not exists viewing_requests_seller_idx on public.viewing_requests(seller_id,status,requested_for);
create index if not exists viewing_requests_buyer_idx on public.viewing_requests(buyer_id,created_at desc);
alter table public.viewing_requests enable row level security;
drop policy if exists viewing_requests_participant_read on public.viewing_requests;
create policy viewing_requests_participant_read on public.viewing_requests for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());
drop policy if exists viewing_requests_buyer_insert on public.viewing_requests;
create policy viewing_requests_buyer_insert on public.viewing_requests for insert to authenticated
  with check (buyer_id = auth.uid() and buyer_id <> seller_id and exists (select 1 from public.listings l where l.id = viewing_requests.listing_id and l.seller_id = viewing_requests.seller_id and l.listing_type = 'accommodation' and l.status = 'available'));
drop policy if exists viewing_requests_seller_update on public.viewing_requests;
create policy viewing_requests_seller_update on public.viewing_requests for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());
drop policy if exists viewing_requests_buyer_update on public.viewing_requests;
create policy viewing_requests_buyer_update on public.viewing_requests for update to authenticated
  using (buyer_id = auth.uid() and status = 'pending') with check (buyer_id = auth.uid() and status = 'cancelled');

-- ---------------------------------------------------------------------------
-- Public vendor storefronts
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_storefronts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  slug text not null unique,
  store_name text not null check (char_length(store_name) between 2 and 80),
  description text check (description is null or char_length(description) <= 800),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vendor_storefronts_slug_idx on public.vendor_storefronts(slug);
alter table public.vendor_storefronts enable row level security;
drop policy if exists vendor_storefronts_public_read on public.vendor_storefronts;
create policy vendor_storefronts_public_read on public.vendor_storefronts for select to anon, authenticated using (true);
drop policy if exists vendor_storefronts_owner_write on public.vendor_storefronts;
create policy vendor_storefronts_owner_write on public.vendor_storefronts for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lightweight seller listing analytics
-- ---------------------------------------------------------------------------
create table if not exists public.listing_view_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists listing_view_events_listing_idx on public.listing_view_events(listing_id,created_at desc);
alter table public.listing_view_events enable row level security;

create or replace function public.record_listing_view(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.listings where id = p_listing_id and status = 'available') then return; end if;
  -- Count signed-in unique viewers only; anonymous refreshes should not inflate analytics.
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.listing_view_events where listing_id = p_listing_id and viewer_id = auth.uid() and created_at > now() - interval '24 hours') then return; end if;
  insert into public.listing_view_events(listing_id,viewer_id) values (p_listing_id,auth.uid());
end;
$$;

create or replace function public.get_my_listing_analytics()
returns table(listing_id uuid, views bigint, inquiries bigint, favourites bigint)
language sql stable security definer set search_path = public
as $$
  select l.id,
    (select count(*) from public.listing_view_events v where v.listing_id = l.id) as views,
    (select count(*) from public.conversations c where c.listing_id = l.id) as inquiries,
    (select count(*) from public.favourites f where f.listing_id = l.id) as favourites
  from public.listings l where l.seller_id = auth.uid();
$$;
revoke all on function public.record_listing_view(uuid) from public;
revoke all on function public.get_my_listing_analytics() from public, anon;
grant execute on function public.record_listing_view(uuid) to anon, authenticated;
grant execute on function public.get_my_listing_analytics() to authenticated;

-- Explicit grants for newly-created user tables.
grant select, insert, update, delete on public.saved_searches to authenticated;
grant select on public.campus_directory to anon, authenticated;
grant select on public.sale_transactions to authenticated;
grant select on public.seller_reviews to anon, authenticated;
grant select, insert, update on public.viewing_requests to authenticated;
grant select, insert, update, delete on public.vendor_storefronts to authenticated;


-- Keep the campus directory current as new campus listings are published.
create or replace function public.sync_campus_directory_from_listing()
returns trigger language plpgsql security definer set search_path = public
as $$
declare campus_slug text;
begin
  if nullif(trim(new.campus),'') is null then return new; end if;
  campus_slug := trim(both '-' from regexp_replace(lower(trim(new.campus)), '[^a-z0-9]+', '-', 'g'));
  if campus_slug <> '' then
    insert into public.campus_directory(name,slug) values(trim(new.campus),campus_slug)
    on conflict (slug) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_sync_campus_directory on public.listings;
create trigger trg_sync_campus_directory after insert or update of campus on public.listings
for each row execute function public.sync_campus_directory_from_listing();

-- Notify landlords and tenants when an accommodation inspection request changes.
create or replace function public.notify_viewing_request_participants()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id,type,title,body,listing_id)
    values (new.seller_id,'viewing_request','New accommodation viewing request','A student requested to inspect your accommodation.',new.listing_id);
  elsif new.status is distinct from old.status then
    insert into public.notifications(user_id,type,title,body,listing_id)
    values (case when auth.uid() = new.buyer_id then new.seller_id else new.buyer_id end,'viewing_update','Viewing request updated','Your accommodation viewing request is now ' || new.status || '.',new.listing_id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_viewing_request on public.viewing_requests;
create trigger trg_notify_viewing_request after insert or update of status on public.viewing_requests
for each row execute function public.notify_viewing_request_participants();

-- ---------------------------------------------------------------------------
-- Service booking requests (tutoring, laundry, design and campus services)
-- ---------------------------------------------------------------------------
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  requested_for timestamptz not null,
  details text check (details is null or char_length(details) <= 800),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
create index if not exists service_requests_seller_idx on public.service_requests(seller_id,status,requested_for);
create index if not exists service_requests_buyer_idx on public.service_requests(buyer_id,created_at desc);
alter table public.service_requests enable row level security;
drop policy if exists service_requests_participant_read on public.service_requests;
create policy service_requests_participant_read on public.service_requests for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());
drop policy if exists service_requests_buyer_insert on public.service_requests;
create policy service_requests_buyer_insert on public.service_requests for insert to authenticated
  with check (buyer_id = auth.uid() and buyer_id <> seller_id and exists (select 1 from public.listings l where l.id = service_requests.listing_id and l.seller_id = service_requests.seller_id and l.category = 'Services' and l.status = 'available'));
drop policy if exists service_requests_seller_update on public.service_requests;
create policy service_requests_seller_update on public.service_requests for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());
drop policy if exists service_requests_buyer_update on public.service_requests;
create policy service_requests_buyer_update on public.service_requests for update to authenticated using (buyer_id = auth.uid() and status = 'pending') with check (buyer_id = auth.uid() and status = 'cancelled');

create or replace function public.notify_service_request_participants()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id,type,title,body,listing_id)
    values (new.seller_id,'service_request','New service request','A customer requested your listed service.',new.listing_id);
  elsif new.status is distinct from old.status then
    insert into public.notifications(user_id,type,title,body,listing_id)
    values (case when auth.uid() = new.buyer_id then new.seller_id else new.buyer_id end,'service_update','Service request updated','Your service request is now ' || new.status || '.',new.listing_id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_service_request on public.service_requests;
create trigger trg_notify_service_request after insert or update of status on public.service_requests
for each row execute function public.notify_service_request_participants();

grant select, insert, update on public.service_requests to authenticated;

-- Let the selected buyer dispute a mistaken sale confirmation, and let the seller
-- reopen a pending transaction without leaving a stale active transaction behind.
create or replace function public.reject_listing_sale(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare tx public.sale_transactions;
begin
  select * into tx from public.sale_transactions where id = p_transaction_id for update;
  if tx.id is null or tx.buyer_id <> auth.uid() then raise exception 'Only the selected buyer can dispute this transaction'; end if;
  if tx.status <> 'awaiting_buyer' then raise exception 'This transaction can no longer be disputed'; end if;
  update public.sale_transactions set status = 'disputed' where id = p_transaction_id;
  update public.listings set status = 'available' where id = tx.listing_id and seller_id = tx.seller_id and status = 'sold';
  insert into public.notifications(user_id,type,title,body,listing_id)
  values (tx.seller_id,'sale_disputed','Buyer did not confirm the sale','The buyer reported that this transaction did not take place. The listing has been made available again.',tx.listing_id);
end;
$$;

create or replace function public.reopen_listing_sale(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare l public.listings;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if l.id is null or l.seller_id <> auth.uid() then raise exception 'Listing not found'; end if;
  update public.sale_transactions set status = 'disputed'
    where listing_id = p_listing_id and seller_id = auth.uid() and status = 'awaiting_buyer';
  update public.listings set status = 'available' where id = p_listing_id;
end;
$$;
revoke all on function public.reject_listing_sale(uuid) from public, anon;
revoke all on function public.reopen_listing_sale(uuid) from public, anon;
grant execute on function public.reject_listing_sale(uuid) to authenticated;
grant execute on function public.reopen_listing_sale(uuid) to authenticated;

create or replace function public.get_seller_trust_stats(p_seller_id uuid)
returns table(average_rating numeric, review_count bigint, completed_transactions bigint)
language sql stable security definer set search_path = public
as $$
  select coalesce((select round(avg(r.rating)::numeric,1) from public.seller_reviews r where r.seller_id = p_seller_id),0),
         (select count(*) from public.seller_reviews r where r.seller_id = p_seller_id),
         (select count(*) from public.sale_transactions t where t.seller_id = p_seller_id and t.status = 'confirmed');
$$;
revoke all on function public.get_seller_trust_stats(uuid) from public;
grant execute on function public.get_seller_trust_stats(uuid) to anon, authenticated;

grant select, insert, update, delete on public.campus_directory to authenticated;

-- Prevent participants from changing the identity or scope of a booking request.
create or replace function public.guard_booking_request_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.id is distinct from old.id or new.listing_id is distinct from old.listing_id
     or new.buyer_id is distinct from old.buyer_id or new.seller_id is distinct from old.seller_id
     or new.requested_for is distinct from old.requested_for or new.details is distinct from old.details
     or new.created_at is distinct from old.created_at then
    raise exception 'Booking request details cannot be changed after submission';
  end if;
  if auth.uid() = old.seller_id and new.status not in ('accepted','declined','completed') then
    raise exception 'The provider can only accept, decline or complete a request';
  elsif auth.uid() = old.buyer_id and new.status <> 'cancelled' then
    raise exception 'The customer can only cancel a pending request';
  elsif auth.uid() not in (old.seller_id,old.buyer_id) then
    raise exception 'Booking request access denied';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_viewing_request_update on public.viewing_requests;
create trigger trg_guard_viewing_request_update before update on public.viewing_requests
for each row execute function public.guard_booking_request_update();
drop trigger if exists trg_guard_service_request_update on public.service_requests;
create trigger trg_guard_service_request_update before update on public.service_requests
for each row execute function public.guard_booking_request_update();

grant select on public.vendor_storefronts to anon, authenticated;
