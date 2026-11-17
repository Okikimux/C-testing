-- CARTOMUX Phase 1 + 2 completion
-- Apply after supabase/cartomux-next-evolution.sql in the isolated test database.
-- No payment, Paystack, escrow, or production configuration is changed.

-- Readable, unique listing slugs. Existing UUID routes remain valid.
alter table public.listings add column if not exists slug text;
create unique index if not exists listings_slug_unique on public.listings(slug) where slug is not null;
create or replace function public.cartomux_listing_slugify(p_title text, p_id uuid)
returns text language sql immutable as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(p_title,'')), '[^a-z0-9]+', '-', 'g')), ''), 'listing') || '-' || left(replace(p_id::text,'-',''),8);
$$;
create or replace function public.cartomux_set_listing_slug()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.slug is null or trim(new.slug)='' or (tg_op='UPDATE' and new.title is distinct from old.title) then
    new.slug := public.cartomux_listing_slugify(new.title,new.id);
  end if;
  return new;
end; $$;
drop trigger if exists trg_cartomux_listing_slug on public.listings;
create trigger trg_cartomux_listing_slug before insert or update of title,slug on public.listings
for each row execute function public.cartomux_set_listing_slug();
update public.listings set slug=public.cartomux_listing_slugify(title,id) where slug is null or trim(slug)='';

-- Delivery / collection coordination lives on the existing verified sale record.
alter table public.sale_transactions
  add column if not exists fulfilment_method text check (fulfilment_method is null or fulfilment_method in ('delivery','pickup')),
  add column if not exists fulfilment_status text not null default 'not_arranged'
    check (fulfilment_status in ('not_arranged','proposed','changes_requested','accepted','in_transit','ready_for_pickup','completed')),
  add column if not exists fulfilment_details text,
  add column if not exists fulfilment_requested_for timestamptz,
  add column if not exists fulfilment_updated_at timestamptz;

create index if not exists sale_transactions_fulfilment_idx
  on public.sale_transactions(fulfilment_status,created_at desc);

-- Admins may inspect disputes; normal users remain limited to their own transactions.
drop policy if exists sale_transactions_admin_read on public.sale_transactions;
create policy sale_transactions_admin_read on public.sale_transactions for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create or replace function public.update_transaction_fulfilment(
  p_transaction_id uuid,
  p_action text,
  p_method text default null,
  p_details text default null,
  p_requested_for timestamptz default null
) returns void language plpgsql security definer set search_path=public as $$
declare tx public.sale_transactions; actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'Sign in to update delivery arrangements'; end if;
  select * into tx from public.sale_transactions where id=p_transaction_id for update;
  if tx.id is null then raise exception 'Transaction not found'; end if;
  if actor not in (tx.buyer_id,tx.seller_id) then raise exception 'Only the buyer or seller can update this arrangement'; end if;
  if tx.status='disputed' then raise exception 'This transaction is disputed; contact CARTOMUX support'; end if;
  if p_details is not null and char_length(p_details)>1000 then raise exception 'Delivery details must be 1,000 characters or fewer'; end if;

  if p_action='propose' then
    if actor<>tx.seller_id then raise exception 'Only the seller can propose delivery or collection'; end if;
    if p_method not in ('delivery','pickup') then raise exception 'Choose delivery or pickup'; end if;
    if nullif(trim(coalesce(p_details,'')),'') is null then raise exception 'Add the delivery address or collection instructions'; end if;
    update public.sale_transactions set fulfilment_method=p_method,fulfilment_status='proposed',
      fulfilment_details=trim(p_details),fulfilment_requested_for=p_requested_for,fulfilment_updated_at=now()
      where id=p_transaction_id;
    insert into public.notifications(user_id,type,title,body,listing_id)
      values(tx.buyer_id,'fulfilment_update','Delivery arrangement proposed','The seller proposed a '||p_method||' arrangement. Review it in your transactions.',tx.listing_id);
  elsif p_action='accept' then
    if actor<>tx.buyer_id or tx.fulfilment_status not in ('proposed','changes_requested') then raise exception 'Only the buyer can accept a pending arrangement'; end if;
    update public.sale_transactions set fulfilment_status='accepted',fulfilment_updated_at=now() where id=p_transaction_id;
    insert into public.notifications(user_id,type,title,body,listing_id) values(tx.seller_id,'fulfilment_update','Arrangement accepted','The buyer accepted your delivery or collection arrangement.',tx.listing_id);
  elsif p_action='request_change' then
    if actor<>tx.buyer_id or tx.fulfilment_status not in ('proposed','changes_requested') then raise exception 'There is no proposed arrangement to change'; end if;
    update public.sale_transactions set fulfilment_status='changes_requested',fulfilment_updated_at=now() where id=p_transaction_id;
    insert into public.notifications(user_id,type,title,body,listing_id) values(tx.seller_id,'fulfilment_update','Buyer requested a change','The buyer would like you to revise the delivery or collection arrangement.',tx.listing_id);
  elsif p_action='dispatch' then
    if actor<>tx.seller_id or tx.fulfilment_method<>'delivery' or tx.fulfilment_status<>'accepted' then raise exception 'Only the seller can dispatch an accepted delivery'; end if;
    update public.sale_transactions set fulfilment_status='in_transit',fulfilment_updated_at=now() where id=p_transaction_id;
    insert into public.notifications(user_id,type,title,body,listing_id) values(tx.buyer_id,'fulfilment_update','Order marked as dispatched','The seller marked your order as on the way.',tx.listing_id);
  elsif p_action='ready' then
    if actor<>tx.seller_id or tx.fulfilment_method<>'pickup' or tx.fulfilment_status<>'accepted' then raise exception 'Only the seller can mark an accepted pickup as ready'; end if;
    update public.sale_transactions set fulfilment_status='ready_for_pickup',fulfilment_updated_at=now() where id=p_transaction_id;
    insert into public.notifications(user_id,type,title,body,listing_id) values(tx.buyer_id,'fulfilment_update','Order ready for collection','The seller marked your order as ready for collection.',tx.listing_id);
  elsif p_action='complete' then
    if actor<>tx.buyer_id or tx.fulfilment_status not in ('in_transit','ready_for_pickup','accepted') then raise exception 'Only the buyer can confirm receipt after the arrangement is accepted'; end if;
    update public.sale_transactions set fulfilment_status='completed',fulfilment_updated_at=now() where id=p_transaction_id;
    insert into public.notifications(user_id,type,title,body,listing_id) values(tx.seller_id,'fulfilment_update','Buyer confirmed receipt','The buyer confirmed that the order was received.',tx.listing_id);
  else
    raise exception 'Unsupported delivery action';
  end if;
end; $$;
revoke all on function public.update_transaction_fulfilment(uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.update_transaction_fulfilment(uuid,text,text,text,timestamptz) to authenticated;

-- Explicit admin dispute resolution. Resolution does not pretend to move or refund money.
alter table public.sale_transactions add column if not exists admin_resolution text,
  add column if not exists admin_resolution_note text,
  add column if not exists admin_resolved_at timestamptz,
  add column if not exists admin_resolved_by uuid references public.profiles(id);
create or replace function public.admin_resolve_marketplace_dispute(
  p_transaction_id uuid,p_resolution text,p_note text
) returns void language plpgsql security definer set search_path=public as $$
declare tx public.sale_transactions;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then raise exception 'Admin access required'; end if;
  if p_resolution not in ('resolved_buyer','resolved_seller','needs_follow_up') then raise exception 'Invalid resolution'; end if;
  if nullif(trim(coalesce(p_note,'')),'') is null or char_length(p_note)>2000 then raise exception 'Add a resolution note of up to 2,000 characters'; end if;
  select * into tx from public.sale_transactions where id=p_transaction_id for update;
  if tx.id is null or tx.status<>'disputed' then raise exception 'Disputed transaction not found'; end if;
  update public.sale_transactions set admin_resolution=p_resolution,admin_resolution_note=trim(p_note),
    admin_resolved_at=now(),admin_resolved_by=auth.uid() where id=p_transaction_id;
  insert into public.notifications(user_id,type,title,body,listing_id)
    values(tx.buyer_id,'dispute_update','Dispute reviewed','CARTOMUX reviewed your transaction report. Check your transaction page for the outcome.',tx.listing_id),
          (tx.seller_id,'dispute_update','Dispute reviewed','CARTOMUX reviewed a report about this transaction. Check your transaction page for the outcome.',tx.listing_id);
end; $$;
revoke all on function public.admin_resolve_marketplace_dispute(uuid,text,text) from public,anon;
grant execute on function public.admin_resolve_marketplace_dispute(uuid,text,text) to authenticated;
