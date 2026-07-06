-- SynaptoCore backend: public lead intake and authenticated admin dashboard.

create schema if not exists synaptocore_private;

create table synaptocore_private.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on schema synaptocore_private from public, anon, authenticated;
revoke all on table synaptocore_private.admin_users from public, anon, authenticated;

create or replace function synaptocore_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from synaptocore_private.admin_users
      where user_id = (select auth.uid())
    );
$$;

revoke all on function synaptocore_private.is_admin() from public;
grant usage on schema synaptocore_private to authenticated;
grant execute on function synaptocore_private.is_admin() to authenticated;

create table public.folders (
  id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  locked boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  folder_id text not null default 'inbox'
    references public.folders (id) on update cascade on delete restrict,
  unread boolean not null default true,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  source text not null default 'website'
    check (char_length(source) between 1 and 40),
  name text not null check (char_length(name) between 1 and 160),
  company text not null check (char_length(company) between 1 and 200),
  email text not null check (
    char_length(email) between 3 and 320
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  phone text not null check (char_length(phone) between 3 and 60),
  selected_package text not null
    check (char_length(selected_package) between 1 and 160),
  message text not null default ''
    check (char_length(message) <= 5000)
);

create index leads_folder_created_idx
  on public.leads (folder_id, created_at desc);

insert into public.folders (id, name, locked, sort_order)
values
  ('inbox', 'Inbox', true, 10),
  ('progress', 'In Progress', true, 20),
  ('pilot', 'Pilot Active', true, 30),
  ('closed', 'Closed', true, 40)
on conflict (id) do update
set
  name = excluded.name,
  locked = excluded.locked,
  sort_order = excluded.sort_order;

alter table public.folders enable row level security;
alter table public.leads enable row level security;

-- Explicit grants are required for projects using the newer Data API defaults.
revoke all on table public.folders from anon, authenticated;
revoke all on table public.leads from anon, authenticated;
grant select, insert, update, delete on table public.folders to authenticated;
grant insert on table public.leads to anon;
grant select, insert, update, delete on table public.leads to authenticated;

create policy "Public can submit valid website leads"
on public.leads
for insert
to anon
with check (
  folder_id = 'inbox'
  and unread = true
  and replied_at is null
  and source = 'website'
);

create policy "Admins can manage folders"
on public.folders
for all
to authenticated
using ((select synaptocore_private.is_admin()))
with check ((select synaptocore_private.is_admin()));

create policy "Admins can manage leads"
on public.leads
for all
to authenticated
using ((select synaptocore_private.is_admin()))
with check ((select synaptocore_private.is_admin()));

comment on table synaptocore_private.admin_users is
  'Allowlist for users who may access the SynaptoCore admin dashboard.';
