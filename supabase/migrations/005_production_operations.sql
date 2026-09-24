alter table public.profiles add column if not exists faculty text;
alter table public.profiles add column if not exists preferred_language text not null default 'sr'
  check (preferred_language in ('sr', 'en'));

do $$ begin
  create type public.task_status as enum ('assigned', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.expense_status as enum ('pending_review', 'approved', 'rejected', 'paid');
exception when duplicate_object then null; end $$;

create table if not exists public.field_tasks (
  id uuid primary key default gen_random_uuid(),
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  address text not null,
  city_village text not null,
  latitude double precision not null,
  longitude double precision not null,
  status public.task_status not null default 'assigned',
  notes text,
  due_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  canvasser_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.field_tasks(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  city_village text not null,
  status public.door_status not null,
  notes text,
  follow_up_requested boolean not null default false,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

insert into public.visits (
  id, canvasser_id, latitude, longitude, address, city_village, status,
  notes, follow_up_requested, completed_at, created_at
)
select
  id, canvasser_id, latitude, longitude,
  trim(concat_ws(' ', address_street, address_number)), city_village, status,
  notes, follow_up_requested, created_at, created_at
from public.canvassing_points
where canvasser_id is not null
on conflict (id) do nothing;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.polling_stations (
  id uuid primary key default gen_random_uuid(),
  station_number text not null,
  municipality text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  coordinator_name text,
  coordinator_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality, station_number)
);

create table if not exists public.travel_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  origin text not null,
  destination text not null,
  travel_date date not null,
  transport_type text not null,
  amount_rsd numeric(10,2) not null check (amount_rsd > 0),
  receipt_path text,
  notes text,
  status public.expense_status not null default 'pending_review',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.field_tasks enable row level security;
alter table public.visits enable row level security;
alter table public.activity_logs enable row level security;
alter table public.polling_stations enable row level security;
alter table public.travel_expenses enable row level security;

grant select on public.field_tasks, public.visits, public.activity_logs,
  public.polling_stations, public.travel_expenses to authenticated;
grant insert on public.visits, public.activity_logs, public.travel_expenses to authenticated;
grant insert, update, delete on public.field_tasks, public.polling_stations to authenticated;

drop policy if exists "assigned staff read tasks" on public.field_tasks;
create policy "assigned staff read tasks" on public.field_tasks for select to authenticated
using (assigned_to = auth.uid() or public.is_admin_or_coordinator());

drop policy if exists "coordinators manage tasks" on public.field_tasks;
create policy "coordinators manage tasks" on public.field_tasks for all to authenticated
using (public.is_admin_or_coordinator())
with check (public.is_admin_or_coordinator());

drop policy if exists "approved staff update assigned tasks" on public.field_tasks;
create policy "approved staff update assigned tasks" on public.field_tasks for update to authenticated
using (assigned_to = auth.uid() and public.is_approved_user())
with check (assigned_to = auth.uid() and public.is_approved_user());

drop policy if exists "approved staff insert visits" on public.visits;
create policy "approved staff insert visits" on public.visits for insert to authenticated
with check (canvasser_id = auth.uid() and public.is_approved_user());

drop policy if exists "staff read permitted visits" on public.visits;
create policy "staff read permitted visits" on public.visits for select to authenticated
using (canvasser_id = auth.uid() or public.is_admin_or_coordinator());

drop policy if exists "approved staff log activity" on public.activity_logs;
create policy "approved staff log activity" on public.activity_logs for insert to authenticated
with check (user_id = auth.uid() and public.is_approved_user());

drop policy if exists "staff read permitted activity" on public.activity_logs;
create policy "staff read permitted activity" on public.activity_logs for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "approved users find polling stations" on public.polling_stations;
create policy "approved users find polling stations" on public.polling_stations for select to authenticated
using (public.is_approved_user());

drop policy if exists "admins manage polling stations" on public.polling_stations;
create policy "admins manage polling stations" on public.polling_stations for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "approved users submit expenses" on public.travel_expenses;
create policy "approved users submit expenses" on public.travel_expenses for insert to authenticated
with check (user_id = auth.uid() and public.is_approved_user() and status = 'pending_review');

drop policy if exists "users read permitted expenses" on public.travel_expenses;
create policy "users read permitted expenses" on public.travel_expenses for select to authenticated
using (user_id = auth.uid() or public.is_admin());

revoke update on public.travel_expenses from anon, authenticated;

create or replace function public.admin_review_expense(
  target_expense_id uuid,
  new_status text,
  review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if new_status not in ('pending_review', 'approved', 'rejected', 'paid') then
    raise exception 'Invalid expense status' using errcode = '22023';
  end if;
  update public.travel_expenses
  set status = new_status::public.expense_status,
      admin_note = nullif(trim(review_note), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = target_expense_id;
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_review_expense(uuid, text, text) from public;
grant execute on function public.admin_review_expense(uuid, text, text) to authenticated;

create or replace function public.admin_update_profile(
  target_user_id uuid,
  new_role text,
  new_region text,
  new_faculty text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if new_role not in ('admin', 'coordinator', 'canvasser', 'poll_watcher') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if target_user_id = auth.uid() and new_role <> 'admin' then
    raise exception 'Administrators cannot remove their own admin role' using errcode = '42501';
  end if;
  update public.profiles
  set role = new_role::public.user_role,
      assigned_region = nullif(trim(new_region), ''),
      faculty = nullif(trim(new_faculty), '')
  where id = target_user_id;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_update_profile(uuid, text, text, text) from public;
grant execute on function public.admin_update_profile(uuid, text, text, text) to authenticated;

create or replace function public.get_faculty_leaderboard()
returns table (
  faculty text,
  completed_visits bigint,
  active_volunteers bigint,
  follow_ups bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_approved_user() then
    raise exception 'Approved account required' using errcode = '42501';
  end if;
  return query
  select
    coalesce(nullif(trim(p.faculty), ''), 'Bez fakulteta') as faculty,
    count(v.id)::bigint as completed_visits,
    count(distinct v.canvasser_id)::bigint as active_volunteers,
    count(v.id) filter (where v.follow_up_requested)::bigint as follow_ups
  from public.profiles p
  left join public.visits v on v.canvasser_id = p.id
  where p.approval_status = 'approved'
  group by coalesce(nullif(trim(p.faculty), ''), 'Bez fakulteta')
  having count(v.id) > 0
  order by completed_visits desc, active_volunteers desc, faculty asc;
end;
$$;

revoke all on function public.get_faculty_leaderboard() from public;
grant execute on function public.get_faculty_leaderboard() to authenticated;

create or replace function public.find_polling_stations(search_text text)
returns setof public.polling_stations
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_approved_user() then
    raise exception 'Approved account required' using errcode = '42501';
  end if;
  return query
  select station.*
  from public.polling_stations station
  where trim(search_text) <> '' and (
    station.address ilike '%' || trim(search_text) || '%'
    or station.municipality ilike '%' || trim(search_text) || '%'
    or station.station_number ilike '%' || trim(search_text) || '%'
  )
  order by station.municipality, station.station_number
  limit 20;
end;
$$;

revoke all on function public.find_polling_stations(text) from public;
grant execute on function public.find_polling_stations(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts','expense-receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "users upload expense receipts" on storage.objects;
create policy "users upload expense receipts" on storage.objects for insert to authenticated
with check (bucket_id='expense-receipts' and (storage.foldername(name))[1]=auth.uid()::text and public.is_approved_user());

drop policy if exists "users read permitted expense receipts" on storage.objects;
create policy "users read permitted expense receipts" on storage.objects for select to authenticated
using (bucket_id='expense-receipts' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));

create index if not exists field_tasks_assignee_status_idx on public.field_tasks (assigned_to, status, due_date);
create index if not exists visits_canvasser_completed_idx on public.visits (canvasser_id, completed_at desc);
create index if not exists activity_logs_user_created_idx on public.activity_logs (user_id, created_at desc);
create index if not exists polling_stations_address_idx on public.polling_stations (municipality, address);
create index if not exists travel_expenses_user_status_idx on public.travel_expenses (user_id, status, created_at desc);

do $$ begin
  alter publication supabase_realtime add table public.field_tasks;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.visits;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.travel_expenses;
exception when duplicate_object then null; end $$;
