create or replace function public.admin_update_profile_role(target_user_id uuid, new_role text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if public.is_root_admin(target_user_id) then raise exception 'The root administrator is protected'; end if;
  if new_role not in ('admin','coordinator','canvasser','poll_watcher') then raise exception 'Invalid profile type'; end if;
  update public.profiles set role=new_role::public.user_role where id=target_user_id;
end; $$;
revoke all on function public.admin_update_profile_role(uuid,text) from public;
grant execute on function public.admin_update_profile_role(uuid,text) to authenticated;
revoke execute on function public.admin_update_profile(uuid,text,text,text) from authenticated;
