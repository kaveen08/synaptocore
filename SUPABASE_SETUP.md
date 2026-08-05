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
user `info@systemio.ch` that should access `/admin/`. Then run this in the SQL
Editor:

```sql
insert into systemio_private.admin_users (user_id)
select id
from auth.users
where email = 'info@systemio.ch'
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

The notification code is versioned in `supabase/functions/submit-lead`,
`supabase/functions/gmail-worker`, `supabase/functions/configure-mailbox`, and
`supabase/functions/send-admin-reply`. The legacy worker slug is retained for
the existing cron schedule; delivery uses the Swizzonic SMTP mailbox, not
Gmail.

Create an ignored file such as `supabase/functions/.env.production` from
`supabase/functions/.env.example`, replace every placeholder, then upload it:

```powershell
npx supabase secrets set --env-file supabase/functions/.env.production
npx supabase functions deploy submit-lead gmail-worker configure-mailbox send-admin-reply send-password-reset --use-api
```

`RATE_LIMIT_SECRET` and `AUTOMATION_SECRET` must be different random values of
at least 32 bytes. `MAILBOX_CREDENTIALS_KEY` must be a base64-encoded random
32-byte value. `ALLOWED_ORIGINS` is a comma-separated list of production
origins. `ADMIN_URL` must be the absolute production `/admin/` URL — currently
`https://systemio.vercel.app/admin/`. Password recovery links redirect to that
exact URL, so change it only together with the redirect allowlist in step 6.

After deployment, open an inquiry in `/admin/`, choose **Verbinden** in the
Swizzonic mailbox panel, and enter the password for `info@systemio.ch`. The
server verifies the credentials against `smtp.mail-ch.ch:465` before encrypting
and storing them. The browser never receives the stored password.

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
  'systemio_project_url'
);

select vault.create_secret(
  'REPLACE_WITH_AUTOMATION_SECRET',
  'systemio_automation_secret'
);
```

Then schedule the worker:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'systemio-gmail-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'systemio_project_url'
    ) || '/functions/v1/gmail-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'systemio_automation_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Check worker runs in `cron.job_run_details` and Edge Function logs. A valid
submission must create one lead plus exactly two `lead_mail_events`. After the
Swizzonic mailbox is connected, queued messages are delivered on the next
worker run.

## 6. Enable admin password recovery

The sign-in screen at `/admin/` offers **Passwort festlegen oder zurücksetzen**.
The `send-password-reset` function looks the address up in the private admin
allowlist, generates a one-time recovery link with the Auth admin API, and
delivers it through the connected Swizzonic mailbox. The link therefore always
arrives in the admin mailbox itself and never depends on the rate-limited
Supabase built-in mailer.

Because delivery uses the Swizzonic mailbox, the mailbox must be connected
**before** you ever need the reset. Sign in to `/admin/`, open the mailbox panel
and choose **Verbinden** once. Without that connection the function answers
`mailbox_not_connected` and no link is sent — and the mailbox can only be
connected from inside the signed-in workspace.

Two things must line up, otherwise Supabase Auth silently rewrites the link
target back to the site URL:

1. Push `20260805103000_admin_password_reset.sql` (`npx supabase db push`). It
   adds `public.admin_recovery_email`, the throttle table, and the grants.
2. In Supabase Dashboard -> Authentication -> URL Configuration set

   - **Site URL**: `https://systemio.vercel.app`
   - **Redirect URLs**: add `https://systemio.vercel.app/admin/`

   These mirror `auth.site_url` and `auth.additional_redirect_urls` in
   `supabase/config.toml`, so `npx supabase config push` applies both. The
   `systemio.ch` entries stay in the allowlist so the custom domain keeps working
   once it points at the site.
3. Keep the `ADMIN_URL` function secret on `https://systemio.vercel.app/admin/`
   (`npx supabase secrets set ADMIN_URL=https://systemio.vercel.app/admin/`).

To verify: open `https://systemio.vercel.app/admin/`, enter the admin address,
choose the reset link, and open the mail in `info@systemio.ch`. The button leads
to `.../auth/v1/verify?...&redirect_to=https://systemio.vercel.app/admin/`, which
returns to the admin screen with the password form. Requests are throttled to
three per address and five per IP address every 15 minutes.
