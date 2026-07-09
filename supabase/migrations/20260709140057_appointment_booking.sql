create table public.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.appointment_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.appointment_slots (id) on delete restrict,
  lead_id uuid not null references public.leads (id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lead_id),
  check (
    (status = 'booked' and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null)
  )
);

create unique index appointment_slots_active_start_unique
  on public.appointment_slots (starts_at)
  where deleted_at is null;

create index appointment_slots_available_idx
  on public.appointment_slots (starts_at)
  where deleted_at is null;

create unique index appointment_bookings_active_slot_unique
  on public.appointment_bookings (slot_id)
  where status = 'booked';

create index appointment_bookings_slot_id_idx
  on public.appointment_bookings (slot_id);

alter table public.appointment_slots enable row level security;
alter table public.appointment_bookings enable row level security;

revoke all on table public.appointment_slots from public, anon, authenticated;
revoke all on table public.appointment_bookings from public, anon, authenticated;
grant select, insert, update on table public.appointment_slots to authenticated;
grant select, update on table public.appointment_bookings to authenticated;
grant select, insert, update on table public.appointment_slots to service_role;
grant select, insert, update on table public.appointment_bookings to service_role;

create policy "Admins can manage appointment slots"
on public.appointment_slots
for all
to authenticated
using ((select synaptocore_private.is_admin()))
with check ((select synaptocore_private.is_admin()));

create policy "Admins can manage appointment bookings"
on public.appointment_bookings
for all
to authenticated
using ((select synaptocore_private.is_admin()))
with check ((select synaptocore_private.is_admin()));

create or replace function public.list_available_appointment_slots()
returns table (
  id uuid,
  starts_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select slot.id, slot.starts_at
  from public.appointment_slots as slot
  where slot.deleted_at is null
    and slot.starts_at >= now()
    and not exists (
      select 1
      from public.appointment_bookings as booking
      where booking.slot_id = slot.id
        and booking.status = 'booked'
    )
  order by slot.starts_at asc
  limit 80;
$$;

revoke all on function public.list_available_appointment_slots()
  from public, anon, authenticated;
grant execute on function public.list_available_appointment_slots()
  to anon;

create or replace function public.create_appointment_lead(
  p_slot_id uuid,
  p_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_message text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_slot public.appointment_slots%rowtype;
begin
  select *
  into v_slot
  from public.appointment_slots
  where id = p_slot_id
    and deleted_at is null
    and starts_at >= now()
  for update;

  if not found then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.appointment_bookings
    where slot_id = p_slot_id
      and status = 'booked'
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

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
    trim(p_phone),
    'Erstgespräch',
    trim(p_message),
    'website',
    'inbox',
    true,
    null
  )
  returning id into v_lead_id;

  insert into public.appointment_bookings (
    slot_id,
    lead_id,
    status,
    booked_at,
    cancelled_at
  )
  values (
    p_slot_id,
    v_lead_id,
    'booked',
    now(),
    null
  );

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
      format('<lead-%s-owner@synaptocore.local>', v_lead_id)
    ),
    (
      v_lead_id,
      'customer_confirmation',
      now(),
      format('<lead-%s-confirmation@synaptocore.local>', v_lead_id)
    );

  return v_lead_id;
end;
$$;

revoke all on function public.create_appointment_lead(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_appointment_lead(uuid, text, text, text, text, text)
  to service_role;

comment on table public.appointment_slots is
  'Admin-managed first-meeting availability exposed publicly only through list_available_appointment_slots().';

comment on table public.appointment_bookings is
  'Appointment reservations linked to website leads. Only one booked reservation may exist per slot.';
