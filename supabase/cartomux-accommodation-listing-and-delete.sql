-- CARTOMUX accommodation pricing and permanent listing deletion support.
-- Apply this migration in the Supabase SQL Editor before deploying the matching app changes.

-- Repair older accommodation listings that were saved with price = 0.
update public.listings
set price = payment_initial
where listing_type = 'accommodation'
  and coalesce(price, 0) = 0
  and coalesce(payment_initial, 0) > 0;

-- Permit an authenticated listing owner to remove images from the listing-images bucket.
-- Uploaded paths follow: <user-id>/<listing-id>/<filename>.
drop policy if exists listing_images_storage_owner_delete on storage.objects;
create policy listing_images_storage_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Ensure rows that reference a listing do not block permanent listing deletion.
-- Any child table with a foreign key to public.listings is updated to cascade on delete.
do $$
declare
  child record;
  definition text;
begin
  for child in
    select c.conrelid::regclass as child_table, c.conname, c.oid
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'public.listings'::regclass
      and c.confdeltype <> 'c'
  loop
    select pg_get_constraintdef(child.oid) into definition;
    definition := regexp_replace(definition, '\s+ON DELETE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)(\s*\([^)]*\))?', '', 'i');
    if position('ON UPDATE' in upper(definition)) > 0 then
      definition := regexp_replace(definition, '\s+ON UPDATE ', ' ON DELETE CASCADE ON UPDATE ', 'i');
    else
      definition := definition || ' ON DELETE CASCADE';
    end if;
    execute format('alter table %s drop constraint %I', child.child_table, child.conname);
    execute format(
      'alter table %s add constraint %I %s',
      child.child_table,
      child.conname,
      definition
    );
  end loop;
end $$;
