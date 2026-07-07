# Supabase setup

The website code is ready. Complete these one-time steps after adding your
project credentials.

## 1. Add the public project configuration

Copy `.env.example` to `.env`. The file must contain these exact variable names
and project values:

```env
PUBLIC_SUPABASE_URL=https://kcynzqtltrgtgwbhsjsc.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SP2Hm8vCCsgfCTxMud1X5A_yJeLgWkh
```

Do not use `SUPABASE_URL` or `SUPABASE_KEY`: Astro only exposes variables with
the `PUBLIC_` prefix to this browser-based integration. The provided key is a
publishable key designed for browser use. Never put a secret key or the legacy
`service_role` key in a `PUBLIC_` variable.

## 2. Apply the database migration

The migration creates the lead and folder tables, RLS policies, explicit Data
API grants, default folders, and the private admin allowlist.

With the Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref kcynzqtltrgtgwbhsjsc
npx supabase db push
```

Alternatively, paste the contents of
`supabase/migrations/20260706142933_supabase_backend.sql` into the Supabase SQL
Editor and run it once.

## 3. Create and authorize the admin user

In Supabase Dashboard -> Authentication -> Users, create the email/password
user that should access `/admin/`. Then run this in the SQL Editor, replacing
the email:

```sql
insert into synaptocore_private.admin_users (user_id)
select id
from auth.users
where email = 'admin@example.com'
on conflict (user_id) do nothing;
```

Only users in this private allowlist can read or change leads and folders.
Regular website visitors can insert a valid lead but cannot read any records.

## 4. Deploy

Add the two `PUBLIC_SUPABASE_*` values to the hosting provider's environment
settings and rebuild the site. Astro substitutes public environment values at
build time.

Run these checks locally:

```powershell
npm test
npm run check
npm run build
```

## 5. Activate lead email notifications

The notification code is versioned in `supabase/functions/submit-lead` and
`supabase/functions/gmail-worker`. Production activation additionally requires
Cloudflare Turnstile and Google OAuth credentials; never commit those values.

### Cloudflare Turnstile

1. Create a Turnstile widget for the production website and restrict it to the
   website hostnames.
2. Add its public site key to the website build environment:

   ```env
   PUBLIC_TURNSTILE_SITE_KEY=...
   ```

3. Keep the Turnstile secret for the Supabase function secrets below.

### Gmail API

1. In Google Cloud, enable the Gmail API and create an OAuth client for
   `synaptocore@gmail.com`.
2. Request offline access with the narrow scopes
   `https://www.googleapis.com/auth/gmail.send` and
   `https://www.googleapis.com/auth/gmail.metadata`.
3. Put the consent app in production and complete any Google verification
   required for durable restricted-scope access. Do not rely on a seven-day
   testing refresh token.
4. Generate one refresh token for `synaptocore@gmail.com`.

Create an ignored file such as `supabase/functions/.env.production` from
`supabase/functions/.env.example`, replace every placeholder, then upload it:

```powershell
npx supabase secrets set --env-file supabase/functions/.env.production
npx supabase functions deploy submit-lead gmail-worker --use-api
```

`RATE_LIMIT_SECRET` and `AUTOMATION_SECRET` must be different random values of
at least 32 bytes. `ALLOWED_ORIGINS` and `TURNSTILE_HOSTNAMES` are comma-separated
production values. `ADMIN_URL` must be the absolute production `/admin/` URL.

### Database and scheduled worker

Apply the mail infrastructure migration, deploy the website with the new form,
verify one protected submission, and then apply
`20260706200231_secure_lead_intake.sql` to remove the legacy anonymous insert
path. If both migrations are pushed together, deploy the website immediately
afterward because the old form can no longer write directly to `leads`.

Create two Vault values in the Supabase SQL editor. Their values must exactly
match the deployed project URL and the `AUTOMATION_SECRET` function secret:

```sql
select vault.create_secret(
  'https://kcynzqtltrgtgwbhsjsc.supabase.co',
  'synaptocore_project_url'
);

select vault.create_secret(
  'REPLACE_WITH_AUTOMATION_SECRET',
  'synaptocore_automation_secret'
);
```

Then schedule the worker:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'synaptocore-gmail-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'synaptocore_project_url'
    ) || '/functions/v1/gmail-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'synaptocore_automation_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Check worker runs in `cron.job_run_details` and Edge Function logs. A valid
submission must create one lead plus exactly two `lead_mail_events`. Replying to
the internal Gmail notification should mark the lead answered within two worker
runs.
