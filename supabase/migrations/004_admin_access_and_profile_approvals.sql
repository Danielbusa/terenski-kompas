do $$
begin
  create type public.profile_approval_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists approval_status public.profile_approval_status not null default 'pending';

-- Administrators that were assigned before this migration must retain access.
update public.profiles
set approval_status = 'approved'
where role = 'admin';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and approval_status = 'approved'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
for select to authenticated
using (auth.uid() = id or public.is_admin());

-- RLS limits rows, not columns. Remove the broad update path that allowed a
-- user to submit changes to security-sensitive fields such as role.
drop policy if exists "profiles update own" on public.profiles;
revoke update on table public.profiles from anon, authenticated;

create or replace function public.admin_set_profile_approval(
  target_user_id uuid,
  new_status text
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

  if new_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid approval status' using errcode = '22023';
  end if;

  if target_user_id = auth.uid() and new_status <> 'approved' then
    raise exception 'Administrators cannot revoke their own approval' using errcode = '42501';
  end if;

  update public.profiles
  set approval_status = new_status::public.profile_approval_status
  where id = target_user_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_profile_approval(uuid, text) from public;
grant execute on function public.admin_set_profile_approval(uuid, text) to authenticated;

create index if not exists profiles_approval_created_idx
  on public.profiles (approval_status, created_at desc);

create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and approval_status = 'approved'
  );
$$;

revoke all on function public.is_approved_user() from public;
grant execute on function public.is_approved_user() to authenticated;

create or replace function public.is_admin_or_coordinator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'coordinator')
      and approval_status = 'approved'
  );
$$;

drop policy if exists "field staff insert points" on public.canvassing_points;
create policy "field staff insert points" on public.canvassing_points
for insert to authenticated
with check (auth.uid() = canvasser_id and public.is_approved_user());

drop policy if exists "field staff insert recruits" on public.recruits;
create policy "field staff insert recruits" on public.recruits
for insert to authenticated
with check (auth.uid() = recruiter_id and public.is_approved_user());

drop policy if exists "field staff insert incidents" on public.incidents;
create policy "field staff insert incidents" on public.incidents
for insert to authenticated
with check (auth.uid() = reporter_id and public.is_approved_user());
