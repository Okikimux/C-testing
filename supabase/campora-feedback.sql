-- CAMPORA feedback inbox. Run once in the Supabase SQL Editor.
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  category text not null default 'general' check (category in ('general','bug','account','listing','safety')),
  message text not null check (char_length(message) between 8 and 3000),
  source_path text,
  status text not null default 'new' check (status in ('new','reviewing','resolved','dismissed')),
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_feedback_status_created_idx on public.user_feedback(status, created_at desc);
create index if not exists user_feedback_user_id_idx on public.user_feedback(user_id);
alter table public.user_feedback enable row level security;
drop policy if exists "Anyone can submit feedback" on public.user_feedback;
create policy "Anyone can submit feedback" on public.user_feedback for insert to anon, authenticated
  with check (char_length(message) between 8 and 3000 and category in ('general','bug','account','listing','safety') and status = 'new' and reviewed_by is null and admin_notes is null
    and (user_id is null or user_id = (select auth.uid())));
drop policy if exists "Admins can view feedback" on public.user_feedback;
create policy "Admins can view feedback" on public.user_feedback for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists "Admins can update feedback" on public.user_feedback;
create policy "Admins can update feedback" on public.user_feedback for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- Keep the admin feedback inbox live when realtime publication is enabled.
do $$ begin alter publication supabase_realtime add table public.user_feedback; exception when duplicate_object then null; end $$;
