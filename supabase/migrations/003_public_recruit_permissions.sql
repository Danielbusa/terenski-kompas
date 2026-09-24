grant usage on schema public to anon, authenticated;
grant insert on table public.recruits to anon, authenticated;

drop policy if exists "public recruit signup" on public.recruits;
create policy "public recruit signup" on public.recruits
for insert to anon, authenticated
with check (recruiter_id is null and source = 'public_join');
