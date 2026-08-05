-- Repair the admin check after the synaptocore -> systemio rename.
--
-- `alter schema ... rename` moves the function but leaves its body text alone,
-- so `systemio_private.is_admin()` kept querying `synaptocore_private.admin_users`.
-- Because `search_path` is pinned to '', every RLS policy that calls it failed
-- with 42P01 and the admin workspace could not load any data at all.

create or replace function systemio_private.is_admin()
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
      from systemio_private.admin_users
      where user_id = (select auth.uid())
    );
$$;

revoke all on function systemio_private.is_admin() from public;
grant usage on schema systemio_private to authenticated;
grant execute on function systemio_private.is_admin() to authenticated;

-- Same breakage: the admin-only retry action still called the old schema.
create or replace function public.retry_lead_mail(p_lead_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if not (select systemio_private.is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.lead_mail_events
  set
    status = 'pending',
    attempts = 0,
    next_attempt_at = now(),
    locked_at = null,
    last_error = null,
    updated_at = now()
  where lead_id = p_lead_id
    and status = 'failed';

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.retry_lead_mail(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.retry_lead_mail(uuid) to authenticated;

-- Fail loudly here rather than silently at request time if anything else still
-- points at the retired schema.
do $check$
declare
  v_stale text;
begin
  select string_agg(format('%s.%s', n.nspname, p.proname), ', ')
  into v_stale
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname in ('public', 'systemio_private')
    and p.prosrc like '%synaptocore_private.%';

  if v_stale is not null then
    raise exception 'Functions still reference synaptocore_private: %', v_stale;
  end if;
end
$check$;
