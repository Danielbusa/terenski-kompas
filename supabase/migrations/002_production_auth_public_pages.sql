alter table public.profiles alter column phone_number drop not null;
alter table public.profiles add column if not exists email text;
alter table public.recruits add column if not exists source text default 'field';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone_number, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), new.phone, 'Volunteer'), new.email, new.phone, 'canvasser')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email, phone on auth.users
for each row execute procedure public.handle_new_user();

create policy "profiles update own" on public.profiles for update
using (auth.uid() = id) with check (auth.uid() = id);

create policy "public recruit signup" on public.recruits for insert to anon, authenticated
with check (recruiter_id is null and source = 'public_join');

create policy "coordinators read recruits" on public.recruits for select
using (recruiter_id = auth.uid() or exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'coordinator')
));

create policy "canvassers read own donations" on public.donations for select
using (canvasser_id = auth.uid() or exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'coordinator')
));

create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id)
);
alter table public.app_config enable row level security;

insert into public.app_config (key, value)
values ('nbs_ips', jsonb_build_object(
  'beneficiaryName', 'STUDENTSKA LISTA - SUSS',
  'account', '840000000000000000',
  'paymentCode', '289',
  'purpose', 'Donacija za SUSS terensku kampanju',
  'referencePrefix', 'SUSS'
)) on conflict (key) do nothing;

create policy "public reads payment config" on public.app_config for select
to anon, authenticated using (key = 'nbs_ips');
create policy "admins manage config" on public.app_config for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('incident-media','incident-media',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "watchers upload incident media" on storage.objects for insert to authenticated
with check (bucket_id='incident-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "owners and coordinators read incident media" on storage.objects for select to authenticated
using (bucket_id='incident-media' and (
  (storage.foldername(name))[1]=auth.uid()::text
  or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','coordinator'))
));

do $$ begin
  alter publication supabase_realtime add table public.canvassing_points;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.incidents;
exception when duplicate_object then null; end $$;

create index if not exists canvassing_points_canvasser_created_idx on public.canvassing_points (canvasser_id, created_at desc);
create index if not exists incidents_status_created_idx on public.incidents (status, created_at desc);
create index if not exists recruits_region_created_idx on public.recruits (city_village, created_at desc);
