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
