alter table public.profiles add column if not exists is_root_admin boolean not null default false;

update public.profiles
set is_root_admin = true, role = 'admin', approval_status = 'approved'
where lower(email) = 'danielbusaa@gmail.com';

create or replace function public.protect_root_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_root_admin then
    if tg_op = 'DELETE' then raise exception 'The root administrator cannot be deleted' using errcode='42501'; end if;
    if new.role <> 'admin' or new.approval_status <> 'approved' or not new.is_root_admin or new.id <> old.id then
      raise exception 'The root administrator security fields are locked' using errcode='42501';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;

drop trigger if exists protect_root_admin_trigger on public.profiles;
create trigger protect_root_admin_trigger before update or delete on public.profiles
for each row execute function public.protect_root_admin();

create or replace function public.can_manage_profile(target_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.profiles actor join public.profiles target on target.id=target_user_id
    where actor.id=auth.uid() and actor.approval_status='approved' and (
      actor.role='admin' or (actor.role='coordinator' and target.role in ('canvasser','poll_watcher') and (
        (nullif(trim(actor.faculty),'') is not null and lower(actor.faculty)=lower(target.faculty)) or
        (nullif(trim(actor.assigned_region),'') is not null and lower(actor.assigned_region)=lower(target.assigned_region))
      ))
    )
  );
$$;
grant execute on function public.can_manage_profile(uuid) to authenticated;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read permitted" on public.profiles for select to authenticated
using (auth.uid()=id or public.is_admin() or public.can_manage_profile(id));

create or replace function public.manage_profile_approval(target_user_id uuid,new_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_manage_profile(target_user_id) then raise exception 'This account is outside your region or faculty' using errcode='42501'; end if;
  if new_status not in ('pending','approved','rejected') then raise exception 'Invalid approval status' using errcode='22023'; end if;
  if exists(select 1 from public.profiles where id=target_user_id and is_root_admin) then raise exception 'The root administrator is locked' using errcode='42501'; end if;
  update public.profiles set approval_status=new_status::public.profile_approval_status where id=target_user_id;
end; $$;
revoke all on function public.manage_profile_approval(uuid,text) from public;
grant execute on function public.manage_profile_approval(uuid,text) to authenticated;

create or replace function public.admin_update_profile(target_user_id uuid,new_role text,new_region text,new_faculty text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if new_role not in ('admin','coordinator','canvasser','poll_watcher') then raise exception 'Invalid role' using errcode='22023'; end if;
  if exists(select 1 from public.profiles where id=target_user_id and is_root_admin) and new_role<>'admin' then raise exception 'The root administrator is locked' using errcode='42501'; end if;
  update public.profiles set role=new_role::public.user_role,assigned_region=nullif(trim(new_region),''),faculty=nullif(trim(new_faculty),'') where id=target_user_id;
  if not found then raise exception 'Profile not found' using errcode='P0002'; end if;
end; $$;

create or replace function public.update_own_profile(new_full_name text,new_phone text,new_region text,new_faculty text,new_language text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if length(trim(new_full_name))<2 then raise exception 'Full name is required' using errcode='22023'; end if;
  if new_language not in ('sr','en') then raise exception 'Invalid language' using errcode='22023'; end if;
  update public.profiles set full_name=trim(new_full_name),phone_number=nullif(trim(new_phone),''),assigned_region=nullif(trim(new_region),''),faculty=nullif(trim(new_faculty),''),preferred_language=new_language where id=auth.uid();
end; $$;
revoke all on function public.update_own_profile(text,text,text,text,text) from public;
grant execute on function public.update_own_profile(text,text,text,text,text) to authenticated;

create or replace function public.admin_delete_rejected_profile(target_user_id uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=target_user_id and approval_status='rejected' and not is_root_admin) then raise exception 'Only rejected, non-root accounts can be deleted' using errcode='42501'; end if;
  update public.recruits set recruiter_id=null where recruiter_id=target_user_id;
  update public.incidents set reporter_id=null where reporter_id=target_user_id;
  update public.donations set canvasser_id=null where canvasser_id=target_user_id;
  delete from public.profiles where id=target_user_id;
  delete from auth.users where id=target_user_id;
end; $$;
revoke all on function public.admin_delete_rejected_profile(uuid) from public;
grant execute on function public.admin_delete_rejected_profile(uuid) to authenticated;

drop policy if exists "approved staff read permitted recruits" on public.recruits;
create policy "approved staff read permitted recruits" on public.recruits for select to authenticated using (
  (recruiter_id=auth.uid() and public.is_approved_user()) or public.is_admin() or exists(
    select 1 from public.profiles actor where actor.id=auth.uid() and actor.role='coordinator' and actor.approval_status='approved'
    and nullif(trim(actor.assigned_region),'') is not null and lower(actor.assigned_region)=lower(city_village)
  )
);

drop policy if exists "admins manage config" on public.app_config;
create policy "approved admins manage config" on public.app_config for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.admin_update_payment_config(config jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if coalesce(length(trim(config->>'beneficiaryName')),0)<2 or coalesce(length(regexp_replace(config->>'account','\D','','g')),0)<15 or coalesce(length(trim(config->>'paymentCode')),0)<>3 then raise exception 'Invalid payment configuration' using errcode='22023'; end if;
  insert into public.app_config(key,value,updated_at,updated_by) values('nbs_ips',config,now(),auth.uid())
  on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
end; $$;
revoke all on function public.admin_update_payment_config(jsonb) from public;
grant execute on function public.admin_update_payment_config(jsonb) to authenticated;
