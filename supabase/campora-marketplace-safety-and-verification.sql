-- CAMPORA marketplace safety, verification workflow, terms acceptance, coupons and moderation.
-- Review and apply this migration to the intended Supabase project after taking a backup.
-- This file does not configure Paystack credentials or execute itself against a live database.

begin;

-- 1) Verification moves through Stage 1 review and a separate payment/waiver stage.
alter table public.student_verifications
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_amount_kobo bigint,
  add column if not exists payment_reference text,
  add column if not exists verified_at timestamptz,
  add column if not exists application_stage smallint not null default 1;

alter table public.student_verifications drop constraint if exists student_verifications_status_check;
alter table public.student_verifications add constraint student_verifications_status_check
  check (status in ('pending','awaiting_payment','approved','rejected'));
alter table public.student_verifications drop constraint if exists student_verifications_payment_status_check;
alter table public.student_verifications add constraint student_verifications_payment_status_check
  check (payment_status in ('unpaid','pending','paid','waived','failed','refunded'));

-- Existing approved records are treated as legacy verified accounts to avoid unexpectedly
-- removing badges or privileges from people who were already verified before this migration.
update public.student_verifications
set payment_status = 'paid', verified_at = coalesce(verified_at, reviewed_at, now()), application_stage = 2
where status = 'approved' and payment_status = 'unpaid';

-- Let an applicant correct and resubmit a rejected application, while requiring the new state to be pending.
drop policy if exists student_verifications_owner_resubmit on public.student_verifications;
create policy student_verifications_owner_resubmit on public.student_verifications
  for update to authenticated
  using (user_id = (select auth.uid()) and status in ('pending','rejected'))
  with check (user_id = (select auth.uid()) and status = 'pending');

-- 2) Record terms acceptance per version without exposing the table publicly.
create table if not exists public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  acceptance_method text not null default 'registration',
  unique(user_id, terms_version)
);
alter table public.terms_acceptances enable row level security;
drop policy if exists terms_acceptances_own_select on public.terms_acceptances;
create policy terms_acceptances_own_select on public.terms_acceptances
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists terms_acceptances_own_insert on public.terms_acceptances;
create policy terms_acceptances_own_insert on public.terms_acceptances
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists terms_acceptances_own_update on public.terms_acceptances;
create policy terms_acceptances_own_update on public.terms_acceptances
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.campora_record_signup_terms_acceptance()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data->>'terms_accepted' = 'true' then
    insert into public.terms_acceptances(user_id,terms_version,accepted_at,acceptance_method)
    values(new.id,coalesce(new.raw_user_meta_data->>'terms_version','2026-10-27'),now(),'registration')
    on conflict(user_id,terms_version) do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists campora_record_signup_terms_acceptance on auth.users;
create trigger campora_record_signup_terms_acceptance after insert on auth.users
  for each row execute function public.campora_record_signup_terms_acceptance();

-- 3) Moderation status, confirmed strikes and appeals are kept separately from public profiles.
create table if not exists public.user_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  strike_count integer not null default 0 check (strike_count between 0 and 3),
  account_status text not null default 'active' check (account_status in ('active','restricted','banned')),
  restriction_reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table if not exists public.moderation_violations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid,
  strike_number integer not null check (strike_number between 1 and 3),
  violation_type text not null,
  finding text not null,
  evidence jsonb not null default '[]'::jsonb,
  action_taken text not null check (action_taken in ('warning','final_warning','temporary_restriction','permanent_ban','immediate_action','reversed')),
  status text not null default 'confirmed' check (status in ('confirmed','appealed','reversed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  reversed_by uuid references auth.users(id),
  reversed_at timestamptz,
  reversal_reason text
);
create table if not exists public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null references public.moderation_violations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 4000),
  status text not null default 'pending' check (status in ('pending','upheld','overturned')),
  reviewer_id uuid references auth.users(id),
  reviewer_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.user_moderation enable row level security;
alter table public.moderation_violations enable row level security;
alter table public.moderation_appeals enable row level security;
-- Users may read their own moderation outcomes and submit an appeal against their own violation.
drop policy if exists user_moderation_own_select on public.user_moderation;
create policy user_moderation_own_select on public.user_moderation for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists moderation_violations_own_select on public.moderation_violations;
create policy moderation_violations_own_select on public.moderation_violations for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists moderation_appeals_own_select on public.moderation_appeals;
create policy moderation_appeals_own_select on public.moderation_appeals for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists moderation_appeals_own_insert on public.moderation_appeals;
create policy moderation_appeals_own_insert on public.moderation_appeals for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.moderation_violations v where v.id = violation_id and v.user_id = (select auth.uid())
  ));

-- Administrators can review moderation records and resolve appeals. No client-side user can issue strikes.
drop policy if exists user_moderation_admin_select on public.user_moderation;
create policy user_moderation_admin_select on public.user_moderation for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists moderation_violations_admin_select on public.moderation_violations;
create policy moderation_violations_admin_select on public.moderation_violations for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists moderation_appeals_admin_select on public.moderation_appeals;
create policy moderation_appeals_admin_select on public.moderation_appeals for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists moderation_appeals_admin_update on public.moderation_appeals;
create policy moderation_appeals_admin_update on public.moderation_appeals for update to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
  with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create or replace function public.campora_admin_issue_strike(
  p_user_id uuid, p_violation_type text, p_finding text, p_evidence jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := auth.uid(); v_count integer; v_action text; v_status text;
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'Administrator access required';
  end if;
  if p_user_id is null or p_user_id=v_admin then raise exception 'Choose a valid user account'; end if;
  if char_length(trim(coalesce(p_violation_type,'')))<3 or char_length(trim(coalesce(p_finding,'')))<10 then
    raise exception 'Provide a violation type and a specific finding of at least 10 characters';
  end if;
  insert into public.user_moderation(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select strike_count into v_count from public.user_moderation where user_id=p_user_id for update;
  if v_count >= 3 then raise exception 'This account has already reached the three-strike limit'; end if;
  v_count := v_count + 1;
  if v_count=1 then v_action:='warning'; v_status:='active';
  elsif v_count=2 then v_action:='final_warning'; v_status:='active';
  else v_action:='permanent_ban'; v_status:='banned'; end if;
  insert into public.moderation_violations(user_id,strike_number,violation_type,finding,evidence,action_taken,created_by)
    values(p_user_id,v_count,trim(p_violation_type),trim(p_finding),coalesce(p_evidence,'[]'::jsonb),v_action,v_admin);
  update public.user_moderation set strike_count=v_count,account_status=v_status,
    restriction_reason=trim(p_finding),updated_at=now(),updated_by=v_admin where user_id=p_user_id;
  return jsonb_build_object('strike_count',v_count,'action_taken',v_action,'account_status',v_status);
end; $$;
revoke all on function public.campora_admin_issue_strike(uuid,text,text,jsonb) from public;
grant execute on function public.campora_admin_issue_strike(uuid,text,text,jsonb) to authenticated;

create or replace function public.campora_admin_resolve_appeal(p_appeal_id uuid,p_outcome text,p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := auth.uid(); v_appeal public.moderation_appeals%rowtype;
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'Administrator access required';
  end if;
  if p_outcome not in ('upheld','overturned') then raise exception 'Invalid appeal outcome'; end if;
  if char_length(trim(coalesce(p_notes,'')))<5 then raise exception 'Add review notes'; end if;
  select * into v_appeal from public.moderation_appeals where id=p_appeal_id for update;
  if not found or v_appeal.status<>'pending' then raise exception 'Appeal is not pending'; end if;
  update public.moderation_appeals set status=p_outcome,reviewer_id=v_admin,reviewer_notes=trim(p_notes),reviewed_at=now() where id=p_appeal_id;
  if p_outcome='overturned' then
    update public.moderation_violations set status='reversed',action_taken='reversed',reversed_by=v_admin,reversed_at=now(),reversal_reason=trim(p_notes) where id=v_appeal.violation_id;
    update public.user_moderation set strike_count=greatest(strike_count-1,0),account_status='active',restriction_reason=null,updated_at=now(),updated_by=v_admin where user_id=v_appeal.user_id;
  else
    update public.moderation_violations set status='confirmed' where id=v_appeal.violation_id;
  end if;
end; $$;
revoke all on function public.campora_admin_resolve_appeal(uuid,text,text) from public;
grant execute on function public.campora_admin_resolve_appeal(uuid,text,text) to authenticated;

-- 4) Coupon serials are user-bound and expire five minutes after creation. Admin-generated coupon
-- codes are also bound to that user's approved Stage 1 application and can be redeemed once.
create table if not exists public.verification_coupon_serials (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  verification_id uuid not null references public.student_verifications(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_coupon_at timestamptz
);
create table if not exists public.verification_coupons (
  id uuid primary key default gen_random_uuid(),
  coupon_code text not null unique,
  serial_id uuid not null unique references public.verification_coupon_serials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verification_id uuid not null references public.student_verifications(id) on delete cascade,
  discount_percent integer not null check (discount_percent in (50,100)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  disabled_at timestamptz,
  reserved_at timestamptz,
  redeemed_at timestamptz,
  payment_reference text
);
alter table public.verification_coupon_serials enable row level security;
alter table public.verification_coupons enable row level security;
drop policy if exists coupon_serials_own_select on public.verification_coupon_serials;
create policy coupon_serials_own_select on public.verification_coupon_serials for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists coupon_serials_admin_select on public.verification_coupon_serials;
create policy coupon_serials_admin_select on public.verification_coupon_serials for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists coupons_own_select on public.verification_coupons;
create policy coupons_own_select on public.verification_coupons for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists coupons_admin_select on public.verification_coupons;
create policy coupons_admin_select on public.verification_coupons for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create or replace function public.campora_create_coupon_serial()
returns table(serial text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_verification public.student_verifications%rowtype; v_serial text;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  select * into v_verification from public.student_verifications
    where user_id = v_user and status = 'awaiting_payment' order by submitted_at desc limit 1;
  if not found then raise exception 'Stage 1 approval is required before requesting a coupon'; end if;
  v_serial := 'CMP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  insert into public.verification_coupon_serials(serial,user_id,verification_id,expires_at)
    values(v_serial,v_user,v_verification.id,now()+interval '5 minutes');
  return query select v_serial, now()+interval '5 minutes';
end; $$;
revoke all on function public.campora_create_coupon_serial() from public;
grant execute on function public.campora_create_coupon_serial() to authenticated;

create or replace function public.campora_admin_generate_verification_coupon(p_serial text, p_discount_percent integer)
returns table(coupon_code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_serial public.verification_coupon_serials%rowtype; v_code text; v_admin uuid := auth.uid();
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'Administrator access required';
  end if;
  if p_discount_percent not in (50,100) then raise exception 'Only 50% and 100% coupons are supported'; end if;
  select * into v_serial from public.verification_coupon_serials where serial=upper(trim(p_serial)) for update;
  if not found or v_serial.expires_at <= now() then raise exception 'Serial is invalid or expired'; end if;
  if v_serial.created_coupon_at is not null then raise exception 'A coupon has already been generated for this serial'; end if;
  if not exists(select 1 from public.student_verifications v where v.id=v_serial.verification_id and v.user_id=v_serial.user_id and v.status='awaiting_payment') then
    raise exception 'The verification application is no longer awaiting payment';
  end if;
  v_code := 'CAMP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.verification_coupons(coupon_code,serial_id,user_id,verification_id,discount_percent,expires_at)
    values(v_code,v_serial.id,v_serial.user_id,v_serial.verification_id,p_discount_percent,now()+interval '5 minutes');
  update public.verification_coupon_serials set created_coupon_at=now() where id=v_serial.id;
  return query select v_code, now()+interval '5 minutes';
end; $$;
revoke all on function public.campora_admin_generate_verification_coupon(text,integer) from public;
grant execute on function public.campora_admin_generate_verification_coupon(text,integer) to authenticated;

create or replace function public.campora_redeem_full_verification_coupon(p_coupon_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_coupon public.verification_coupons%rowtype;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  select * into v_coupon from public.verification_coupons
    where coupon_code=upper(trim(p_coupon_code)) and user_id=v_user for update;
  if not found or v_coupon.expires_at <= now() or v_coupon.disabled_at is not null or v_coupon.redeemed_at is not null then
    raise exception 'Coupon is invalid, expired, disabled or already used';
  end if;
  if v_coupon.discount_percent <> 100 then
    update public.verification_coupons set reserved_at=coalesce(reserved_at,now()) where id=v_coupon.id;
    return jsonb_build_object('discount_percent',50,'amount_due_naira',case
      when (select verification_type from public.student_verifications where id=v_coupon.verification_id)='student' then 750 else 1000 end,
      'payment_required',true,'message','Coupon accepted. The remaining payment must be confirmed before verification is completed.');
  end if;
  update public.verification_coupons set redeemed_at=now() where id=v_coupon.id;
  update public.student_verifications set status='approved',payment_status='waived',payment_amount_kobo=0,
    application_stage=2,verified_at=now(),payment_reference='coupon:'||v_coupon.coupon_code
    where id=v_coupon.verification_id and user_id=v_user and status='awaiting_payment';
  if not found then raise exception 'Verification application is no longer eligible for this coupon'; end if;
  return jsonb_build_object('discount_percent',100,'amount_due_naira',0,'payment_required',false,'verified',true);
end; $$;
revoke all on function public.campora_redeem_full_verification_coupon(text) from public;
grant execute on function public.campora_redeem_full_verification_coupon(text) to authenticated;

create or replace function public.campora_admin_disable_verification_coupon(p_coupon_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := auth.uid();
begin
  if v_admin is null or not exists(select 1 from public.profiles p where p.id=v_admin and p.role='admin') then
    raise exception 'Administrator access required';
  end if;
  update public.verification_coupons set disabled_at=now()
    where coupon_code=upper(trim(p_coupon_code)) and redeemed_at is null;
  if not found then raise exception 'Coupon not found or already redeemed'; end if;
end; $$;
revoke all on function public.campora_admin_disable_verification_coupon(text) from public;
grant execute on function public.campora_admin_disable_verification_coupon(text) to authenticated;

-- 5) Enforce listing caps and account restrictions in the database, not only in the UI.
create or replace function public.campora_enforce_listing_publish_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_count bigint; v_verified boolean; v_account_status text;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if new.seller_id is distinct from v_user and not exists(select 1 from public.profiles p where p.id=v_user and p.role='admin') then
    raise exception 'You can only publish listings for your own account';
  end if;
  select m.account_status into v_account_status from public.user_moderation m where m.user_id=new.seller_id;
  if v_account_status in ('restricted','banned') then raise exception 'Your account is restricted from publishing listings'; end if;
  select exists(select 1 from public.student_verifications v where v.user_id=new.seller_id and v.status='approved' and v.payment_status in ('paid','waived')) into v_verified;
  if new.status='available' and not v_verified then
    select count(*) into v_count from public.listings l where l.seller_id=new.seller_id and l.status='available' and (tg_op <> 'UPDATE' or l.id <> new.id);
    if v_count >= 5 then raise exception 'Unverified accounts can have up to five active listings. Complete verification or hide an existing listing.'; end if;
  end if;
  return new;
end; $$;
revoke all on function public.campora_enforce_listing_publish_rules() from public;
drop trigger if exists campora_listing_publish_rules on public.listings;
create trigger campora_listing_publish_rules before insert or update on public.listings
  for each row execute function public.campora_enforce_listing_publish_rules();

-- 6) Indexes used by the listing cap, coupon serial expiry and moderation dashboard.
create index if not exists listings_seller_status_idx on public.listings(seller_id,status);
create index if not exists verification_coupon_serials_user_expiry_idx on public.verification_coupon_serials(user_id,expires_at desc);
create index if not exists verification_coupons_user_expiry_idx on public.verification_coupons(user_id,expires_at desc);
create index if not exists moderation_violations_user_created_idx on public.moderation_violations(user_id,created_at desc);
create index if not exists moderation_appeals_status_created_idx on public.moderation_appeals(status,created_at desc);

commit;
