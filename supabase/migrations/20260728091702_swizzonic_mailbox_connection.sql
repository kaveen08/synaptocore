create table public.mailbox_connections (
  singleton boolean primary key default true check (singleton),
  provider text not null default 'swizzonic'
    check (provider = 'swizzonic'),
  host text not null default 'smtp.mail-ch.ch'
    check (host = 'smtp.mail-ch.ch'),
  port smallint not null default 465
    check (port = 465),
  username text not null
    check (
      char_length(username) between 3 and 320
      and username ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  encrypted_password text not null
    check (char_length(encrypted_password) between 16 and 4096),
  password_iv text not null
    check (char_length(password_iv) between 16 and 64),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mailbox_connections enable row level security;

revoke all on table public.mailbox_connections
  from public, anon, authenticated;
grant select, insert, update, delete on table public.mailbox_connections
  to service_role;

comment on table public.mailbox_connections is
  'Encrypted server-side credentials for the Systemio Swizzonic mailbox. No browser role can read this table.';
