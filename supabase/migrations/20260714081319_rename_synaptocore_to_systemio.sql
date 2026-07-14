-- Carry existing deployments forward after the public brand rename.
-- Fresh databases already use the Systemio identifiers from the baseline migrations.
do $migration$
declare
  v_definition text;
  v_signature text;
  v_secret record;
  v_legacy_name text;
  v_systemio_name text;
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

  -- Rename the Vault values used by the scheduled Gmail worker when present.
  if to_regprocedure('vault.update_secret(uuid,text,text,text)') is not null then
    for v_legacy_name, v_systemio_name in
      select legacy_name, systemio_name
      from (
        values
          ('synaptocore_project_url', 'systemio_project_url'),
          ('synaptocore_automation_secret', 'systemio_automation_secret')
      ) as secret_names (legacy_name, systemio_name)
    loop
      for v_secret in execute
        'select id, decrypted_secret, description
           from vault.decrypted_secrets
          where name = $1
            and not exists (
              select 1 from vault.decrypted_secrets where name = $2
            )'
        using v_legacy_name, v_systemio_name
      loop
        execute 'select vault.update_secret($1, $2, $3, $4)'
          using
            v_secret.id,
            v_secret.decrypted_secret,
            v_systemio_name,
            v_secret.description;
      end loop;
    end loop;
  end if;

  -- Keep an existing pg_cron invocation pointed at the renamed Vault values.
  if to_regclass('cron.job') is not null then
    execute
      'update cron.job
          set jobname = replace(jobname, $1, $2),
              command = replace(command, $1, $2)
        where jobname like ''%'' || $1 || ''%''
           or command like ''%'' || $1 || ''%'''
      using 'synaptocore', 'systemio';
  end if;
end
$migration$;
