-- CARTOMUX account types: every account is either a STUDENT or a VENDOR.
-- Run this in the Supabase SQL editor BEFORE deploying the matching app update.
-- It is safe to run more than once (if you already ran an earlier version, run it again to get the latest rules).
--
-- Note: `profiles.role` is still the permission role (student / admin) and is NOT touched.
-- `profiles.account_type` is the new "what kind of seller are you" field.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists account_type text not null default 'student';
alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists business_category text;

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check
  check (account_type in ('student', 'vendor'));

alter table public.profiles drop constraint if exists profiles_business_name_length_check;
alter table public.profiles add constraint profiles_business_name_length_check
  check (business_name is null or char_length(business_name) between 2 and 80);

alter table public.profiles drop constraint if exists profiles_business_category_check;
alter table public.profiles add constraint profiles_business_category_check
  check (business_category is null or business_category = any (array[
    'Retail / shop', 'Food and groceries', 'Fashion', 'Repairs / artisan', 'Accommodation', 'Services', 'Other'
  ]::text[]));

create index if not exists profiles_account_type_idx on public.profiles(account_type);

-- ---------------------------------------------------------------------------
-- 2. Backfill existing accounts
--    Anyone who already runs a storefront, or already applied as a non-student
--    vendor, becomes a vendor. Everyone else stays a student (the default).
-- ---------------------------------------------------------------------------
update public.profiles p
set account_type = 'vendor',
    business_name = coalesce(p.business_name, s.store_name)
from public.vendor_storefronts s
where s.owner_id = p.id and p.account_type = 'student';

update public.profiles p
set account_type = 'vendor',
    business_name = coalesce(
      p.business_name,
      case when char_length(trim(coalesce(v.business_name, ''))) >= 2 then left(trim(v.business_name), 80) end
    ),
    business_category = coalesce(
      p.business_category,
      case when v.business_category = any (array[
        'Retail / shop', 'Food and groceries', 'Fashion', 'Repairs / artisan', 'Accommodation', 'Services', 'Other'
      ]::text[]) then v.business_category end
    )
from public.student_verifications v
where v.user_id = p.id and v.verification_type = 'vendor' and p.account_type = 'student';

-- ---------------------------------------------------------------------------
-- 3. New sign-ups: read the account type chosen on the registration form
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_type text := case when new.raw_user_meta_data->>'account_type' = 'vendor' then 'vendor' else 'student' end;
  v_business text := nullif(left(trim(coalesce(new.raw_user_meta_data->>'business_name', '')), 80), '');
  v_category text := nullif(trim(coalesce(new.raw_user_meta_data->>'business_category', '')), '');
begin
  if v_business is not null and char_length(v_business) < 2 then v_business := null; end if;
  if v_category is not null and v_category <> all (array[
    'Retail / shop', 'Food and groceries', 'Fashion', 'Repairs / artisan', 'Accommodation', 'Services', 'Other'
  ]::text[]) then v_category := null; end if;
  if v_type <> 'vendor' then v_business := null; v_category := null; end if;

  insert into public.profiles(id, full_name, campus, avatar_url, account_type, business_name, business_category)
  values(
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'campus',
    new.raw_user_meta_data->>'avatar_url',
    v_type, v_business, v_category
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The account type can only be changed through set_account_type() below,
--    never by a plain profile update from the browser.
-- ---------------------------------------------------------------------------
create or replace function public.protect_account_type()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null
     and tg_op = 'UPDATE'
     and new.account_type is distinct from old.account_type
     and coalesce(current_setting('cartomux.account_type_change', true), '') <> 'on' then
    raise exception 'Use the account type switch in Settings to change your account type.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_account_type on public.profiles;
create trigger protect_account_type before update on public.profiles
  for each row execute function public.protect_account_type();
revoke execute on function public.protect_account_type() from public, anon, authenticated;

create or replace function public.set_account_type(
  p_account_type text,
  p_business_name text default null,
  p_business_category text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := nullif(trim(coalesce(p_business_name, '')), '');
  v_category text := nullif(trim(coalesce(p_business_category, '')), '');
begin
  if v_user is null then raise exception 'Please sign in first.'; end if;

  -- Locked once verification is paid for (or fully waived). It unlocks again if the payment is refunded.
  if exists (
    select 1 from public.student_verifications v
    where v.user_id = v_user and v.payment_status in ('paid', 'waived')
  ) then
    raise exception 'Your account type is locked because your verification payment has been confirmed. Please contact CARTOMUX support if you need a change.';
  end if;

  if p_account_type is null or p_account_type not in ('student', 'vendor') then
    raise exception 'Choose either a student or a vendor account.';
  end if;
  if p_account_type = 'vendor' then
    if v_name is null or char_length(v_name) not between 2 and 80 then
      raise exception 'Enter your business or shop name (2 to 80 characters).';
    end if;
    if v_category is not null and v_category <> all (array[
      'Retail / shop', 'Food and groceries', 'Fashion', 'Repairs / artisan', 'Accommodation', 'Services', 'Other'
    ]::text[]) then
      raise exception 'Choose a valid business category.';
    end if;
  end if;

  perform set_config('cartomux.account_type_change', 'on', true);
  update public.profiles
  set account_type = p_account_type,
      -- Business details are kept when switching back to student, so switching again restores them.
      business_name = case when p_account_type = 'vendor' then v_name else business_name end,
      business_category = case when p_account_type = 'vendor' then v_category else business_category end
  where id = v_user;
  if not found then raise exception 'Profile not found.'; end if;

  return jsonb_build_object('account_type', p_account_type, 'business_name', v_name, 'business_category', v_category);
end;
$$;
revoke all on function public.set_account_type(text, text, text) from public, anon;
grant execute on function public.set_account_type(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Storefronts are a vendor-only feature
-- ---------------------------------------------------------------------------
create or replace function public.is_vendor(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = p_user and account_type = 'vendor') $$;
grant execute on function public.is_vendor(uuid) to anon, authenticated;

-- Public pages only show storefronts that belong to vendor accounts. If an owner switches
-- to a student account the storefront is hidden (not deleted) and returns if they switch back.
drop policy if exists vendor_storefronts_public_read on public.vendor_storefronts;
create policy vendor_storefronts_public_read on public.vendor_storefronts
  for select to anon, authenticated using (public.is_vendor(owner_id));

drop policy if exists vendor_storefronts_owner_write on public.vendor_storefronts;
drop policy if exists vendor_storefronts_owner_insert on public.vendor_storefronts;
drop policy if exists vendor_storefronts_owner_update on public.vendor_storefronts;
drop policy if exists vendor_storefronts_owner_delete on public.vendor_storefronts;
create policy vendor_storefronts_owner_insert on public.vendor_storefronts
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.is_vendor((select auth.uid())));
create policy vendor_storefronts_owner_update on public.vendor_storefronts
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.is_vendor((select auth.uid())));
create policy vendor_storefronts_owner_delete on public.vendor_storefronts
  for delete to authenticated using (owner_id = (select auth.uid()));
