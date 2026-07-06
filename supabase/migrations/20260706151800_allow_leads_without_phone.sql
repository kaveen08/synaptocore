alter table public.leads
  alter column phone drop not null,
  alter column selected_package set default 'Erstgespräch';

comment on column public.leads.phone is
  'Optional callback number. Public first-meeting requests may be submitted without one.';

comment on column public.leads.selected_package is
  'Package or enquiry type. New general website enquiries default to Erstgespräch.';
