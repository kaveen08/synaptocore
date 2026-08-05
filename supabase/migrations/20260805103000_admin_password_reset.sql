-- Self-service password recovery for allowlisted Systemio admins.
-- Recovery links are generated server side and delivered through the connected
-- Swizzonic mailbox, so they always arrive in the admin inbox itself.

create table public.admin_reset_limits (
  limit_key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now()
);

create index admin_reset_limits_updated_at_idx
  on public.admin_reset_limits (updated_at);

alter table public.admin_reset_limits enable row level security;

revoke all on table public.admin_reset_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_reset_limits
  to service_role;

create or replace function public.record_admin_reset_attempt(
  p_limit_key text,
  p_limit integer default 3,
  p_window interval default interval '15 minutes'
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  insert into public.admin_reset_limits (
    limit_key,
    window_started_at,
    attempts,
    updated_at
  )
  values (p_limit_key, now(), 1, now())
  on conflict (limit_key) do update
  set
    window_started_at = case
      when public.admin_reset_limits.window_started_at <= now() - p_window
        then now()
      else public.admin_reset_limits.window_started_at
    end,
    attempts = case
      when public.admin_reset_limits.window_started_at <= now() - p_window
        then 1
      else public.admin_reset_limits.attempts + 1
    end,
    updated_at = now()
  returning attempts into v_attempts;

  return v_attempts <= greatest(1, p_limit);
end;
$$;

revoke all on function public.record_admin_reset_attempt(text, integer, interval)
  from public, anon, authenticated;
grant execute on function public.record_admin_reset_attempt(text, integer, interval)
  to service_role;

-- Resolves a typed login address to the stored mailbox of an allowlisted admin.
-- Returns null for every other address, so the recovery endpoint can never mail
-- a link to somebody who is not in systemio_private.admin_users.
create or replace function public.admin_recovery_email(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select users.email::text
  from auth.users as users
  join systemio_private.admin_users as admins
    on admins.user_id = users.id
  where lower(users.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.admin_recovery_email(text)
  from public, anon, authenticated;
grant execute on function public.admin_recovery_email(text) to service_role;

comment on table public.admin_reset_limits is
  'Throttles password recovery requests per client IP and per address.';
comment on function public.admin_recovery_email(text) is
  'Returns the admin mailbox for an allowlisted login address. Service role only.';
