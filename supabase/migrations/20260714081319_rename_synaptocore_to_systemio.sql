-- Carry existing deployments forward after the public brand rename.
-- Fresh databases already use the Systemio identifiers from the baseline migrations.
do $migration$
declare
  v_definition text;
  v_signature text;
begin
  if exists (
    select 1 from pg_namespace where nspname = 'synaptocore_private'
  ) and exists (
    select 1 from pg_namespace where nspname = 'systemio_private'
  ) then
    raise exception 'Both legacy and Systemio private schemas exist; merge them before continuing.';
  elsif exists (
    select 1 from pg_namespace where nspname = 'synaptocore_private'
  ) then
    alter schema synaptocore_private rename to systemio_private;
  end if;

  -- Keep future RFC Message-IDs aligned with the new brand while preserving
  -- identifiers already assigned to queued or delivered messages.
  foreach v_signature in array array[
    'public.create_website_lead(text,text,text,text)',
    'public.create_appointment_lead(uuid,text,text,text,text,text)'
  ]
  loop
    select pg_get_functiondef(to_regprocedure(v_signature))
    into v_definition;

    if v_definition is not null then
      execute replace(
        v_definition,
        '@synaptocore.local>',
        '@systemio.local>'
      );
    end if;
  end loop;

  -- Existing Vault and cron identifiers are intentionally left unchanged.
  -- Their values are internal deployment details and remain valid after the
  -- public product/schema rename.
end
$migration$;
