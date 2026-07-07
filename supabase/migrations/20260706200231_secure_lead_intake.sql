-- Apply only after submit-lead is deployed and the website uses the Edge Function.
drop policy if exists "Public can submit valid website leads" on public.leads;
revoke insert on table public.leads from anon;
