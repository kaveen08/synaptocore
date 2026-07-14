create table public.lead_mail_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null check (kind in ('owner_notification', 'customer_confirmation')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 6),
  next_attempt_at timestamptz,
  locked_at timestamptz,
  rfc_message_id text not null,
  provider_message_id text,
  provider_thread_id text,
  reply_message_id text,
  reply_synced_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, kind),
  unique (rfc_message_id)
);

create index lead_mail_events_lead_id_idx
  on public.lead_mail_events (lead_id);

create index lead_mail_events_due_idx
  on public.lead_mail_events (next_attempt_at, created_at)
  where status in ('pending', 'processing', 'failed');

create index lead_mail_events_thread_idx
  on public.lead_mail_events (provider_thread_id)
  where provider_thread_id is not null;

create table public.lead_submission_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now()
);

create index lead_submission_limits_updated_at_idx
  on public.lead_submission_limits (updated_at);

create table public.gmail_sync_state (
  singleton boolean primary key default true check (singleton),
  history_id text,
  updated_at timestamptz not null default now()
);

insert into public.gmail_sync_state (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.lead_mail_events enable row level security;
alter table public.lead_submission_limits enable row level security;
alter table public.gmail_sync_state enable row level security;

revoke all on table public.lead_mail_events from public, anon, authenticated;
revoke all on table public.lead_submission_limits from public, anon, authenticated;
revoke all on table public.gmail_sync_state from public, anon, authenticated;

grant select, insert, update, delete on table public.lead_mail_events to service_role;
grant select, insert, update, delete on table public.lead_submission_limits to service_role;
grant select, insert, update, delete on table public.gmail_sync_state to service_role;
grant select on table public.lead_mail_events to authenticated;
grant select, insert, update on table public.leads to service_role;

create policy "Admins can view lead mail delivery"
on public.lead_mail_events
for select
to authenticated
using ((select systemio_private.is_admin()));

create or replace function public.create_website_lead(
  p_name text,
  p_company text,
  p_email text,
  p_message text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
begin
  insert into public.leads (
    name,
    company,
    email,
    phone,
    selected_package,
    message,
    source,
    folder_id,
    unread,
    replied_at
  )
  values (
    trim(p_name),
    trim(p_company),
    lower(trim(p_email)),
    null,
    'Erstgespräch',
    trim(p_message),
    'website',
    'inbox',
    true,
    null
  )
  returning id into v_lead_id;

  insert into public.lead_mail_events (
    lead_id,
    kind,
    next_attempt_at,
    rfc_message_id
  )
  values
    (
      v_lead_id,
      'owner_notification',
      now(),
      format('<lead-%s-owner@systemio.local>', v_lead_id)
    ),
    (
      v_lead_id,
      'customer_confirmation',
      now(),
      format('<lead-%s-confirmation@systemio.local>', v_lead_id)
    );

  return v_lead_id;
end;
$$;

revoke all on function public.create_website_lead(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_website_lead(text, text, text, text)
  to service_role;

create or replace function public.record_lead_submission_attempt(
  p_ip_hash text,
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
  insert into public.lead_submission_limits (
    ip_hash,
    window_started_at,
    attempts,
    updated_at
  )
  values (p_ip_hash, now(), 1, now())
  on conflict (ip_hash) do update
  set
    window_started_at = case
      when public.lead_submission_limits.window_started_at <= now() - p_window
        then now()
      else public.lead_submission_limits.window_started_at
    end,
    attempts = case
      when public.lead_submission_limits.window_started_at <= now() - p_window
        then 1
      else public.lead_submission_limits.attempts + 1
    end,
    updated_at = now()
  returning attempts into v_attempts;

  return v_attempts <= greatest(1, p_limit);
end;
$$;

revoke all on function public.record_lead_submission_attempt(text, integer, interval)
  from public, anon, authenticated;
grant execute on function public.record_lead_submission_attempt(text, integer, interval)
  to service_role;

create or replace function public.claim_due_lead_mail_events(
  p_limit integer default 10
)
returns setof public.lead_mail_events
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with due as (
    select event.id
    from public.lead_mail_events as event
    where event.attempts < 6
      and (
        (
          event.status in ('pending', 'failed')
          and event.next_attempt_at is not null
          and event.next_attempt_at <= now()
        )
        or (
          event.status = 'processing'
          and event.locked_at <= now() - interval '10 minutes'
        )
      )
    order by event.next_attempt_at nulls first, event.created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 50)
  )
  update public.lead_mail_events as event
  set
    status = 'processing',
    attempts = event.attempts + 1,
    locked_at = now(),
    updated_at = now()
  from due
  where event.id = due.id
  returning event.*;
end;
$$;

revoke all on function public.claim_due_lead_mail_events(integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_lead_mail_events(integer)
  to service_role;

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
grant execute on function public.retry_lead_mail(uuid)
  to authenticated;

comment on table public.lead_mail_events is
  'Durable Gmail delivery queue and reply-thread correlation for website leads.';

comment on table public.lead_submission_limits is
  'Short-lived HMAC hashes used for server-side website lead rate limiting.';
