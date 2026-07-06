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
npm run check
npm run build
```
