create extension if not exists pg_trgm;

create table if not exists public.serbian_locations (
  id bigint primary key,
  name text not null,
  ascii_name text,
  municipality text,
  district text,
  latitude double precision not null,
  longitude double precision not null,
  feature_code text not null,
  population bigint not null default 0,
  source text not null default 'GeoNames',
  source_updated_at date,
  search_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists serbian_locations_search_idx on public.serbian_locations using gin (search_text gin_trgm_ops);
create index if not exists serbian_locations_municipality_idx on public.serbian_locations (municipality, name);
alter table public.serbian_locations enable row level security;
drop policy if exists "Locations are publicly readable" on public.serbian_locations;
create policy "Locations are publicly readable" on public.serbian_locations for select to anon, authenticated using (active);
drop policy if exists "Admins manage locations" on public.serbian_locations;
create policy "Admins manage locations" on public.serbian_locations for all to authenticated
using (public.is_admin()) with check (public.is_admin());
grant select on public.serbian_locations to anon, authenticated;
grant insert, update, delete on public.serbian_locations to authenticated;

alter table public.profiles add column if not exists location_id bigint references public.serbian_locations(id) on delete set null;
alter table public.recruits add column if not exists location_id bigint references public.serbian_locations(id) on delete set null;
alter table public.website_leads add column if not exists location_id bigint references public.serbian_locations(id) on delete set null;
alter table public.field_tasks add column if not exists location_id bigint references public.serbian_locations(id) on delete set null;
alter table public.tour_stops add column if not exists location_id bigint references public.serbian_locations(id) on delete set null;
alter table public.tour_stops add column if not exists source_url text;
alter table public.tour_stops add column if not exists external_id text;
create unique index if not exists tour_stops_external_id_idx on public.tour_stops(external_id) where external_id is not null;

create table if not exists public.suss_ingestion_items (
  id text primary key,
  source_url text not null,
  source_name text not null,
  kind text not null check (kind in ('historical_visit','upcoming_action','guideline')),
  extracted_text text,
  status text not null default 'needs_review' check (status in ('needs_review','imported','ignored')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.suss_ingestion_items enable row level security;
create policy "Admins manage ingestion items" on public.suss_ingestion_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select,insert,update,delete on public.suss_ingestion_items to authenticated;

create or replace function public.search_serbian_locations(search_query text, result_limit integer default 40)
returns table(id bigint,name text,municipality text,district text,latitude double precision,longitude double precision)
language sql stable security invoker set search_path=public as $$
  select l.id,l.name,l.municipality,l.district,l.latitude,l.longitude
  from public.serbian_locations l
  where l.active and (
    length(trim(coalesce(search_query,''))) < 2
    or lower(l.name || ' ' || coalesce(l.ascii_name,'') || ' ' || coalesce(l.municipality,'') || ' ' || coalesce(l.district,'')) % lower(trim(search_query))
    or lower(l.name || ' ' || coalesce(l.ascii_name,'') || ' ' || coalesce(l.municipality,'') || ' ' || coalesce(l.district,'')) like '%' || lower(trim(search_query)) || '%'
  )
  order by
    case when lower(l.name)=lower(trim(search_query)) then 0 when lower(l.name) like lower(trim(search_query)) || '%' then 1 else 2 end,
    similarity(lower(l.name || ' ' || coalesce(l.ascii_name,'') || ' ' || coalesce(l.municipality,'') || ' ' || coalesce(l.district,'')),lower(trim(search_query))) desc,
    l.population desc,l.name
  limit least(greatest(coalesce(result_limit,40),1),80)
$$;
grant execute on function public.search_serbian_locations(text,integer) to anon, authenticated;

create or replace function public.update_own_profile(
  new_full_name text,new_phone text,new_region text,new_university_id uuid,new_faculty_id uuid,new_language text,
  new_location_id bigint default null
) returns void language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set
    full_name=nullif(trim(new_full_name),''),phone_number=nullif(trim(new_phone),''),
    assigned_region=nullif(trim(new_region),''),university_id=new_university_id,faculty_id=new_faculty_id,
    preferred_language=case when new_language in ('sr','en') then new_language else 'sr' end,
    location_id=new_location_id,updated_at=now()
  where id=auth.uid();
end $$;
grant execute on function public.update_own_profile(text,text,text,uuid,uuid,text,bigint) to authenticated;

insert into public.field_documents (slug,title_sr,title_en,content_sr,content_en,category,display_order,published)
values
('verification-guide','Provera identiteta i predstavljanja','Identity verification and introduction','Pre obilaska proveri akreditaciju, predstavi se punim imenom i jasno objasni razlog razgovora. Nikada ne traži fotografiju ličnog dokumenta, JMBG, broj kartice ili pristup telefonu. Ako sagovornik odbije razgovor, ljubazno se zahvali i odmah prekini kontakt.','Before a visit, check your accreditation, introduce yourself by full name, and clearly explain the purpose of the conversation. Never request an ID photo, national ID number, bank-card details, or access to a phone. If someone declines, thank them and end the contact immediately.','verification',10,true),
('field-safety','Bezbednost na terenu','Field safety','Radi u paru kada god je moguće, podeli plan rute sa koordinatorom i ne ulazi u privatni prostor bez jasnog poziva. U slučaju pretnje ili konflikta udalji se, pozovi koordinatora i po potrebi hitne službe. Ne objavljuj lične podatke građana i fotografiši samo uz dozvolu.','Work in pairs whenever possible, share your route with the coordinator, and never enter private property without a clear invitation. If threatened or confronted, leave, contact the coordinator, and call emergency services when necessary. Do not publish residents personal data and take photos only with permission.','safety',20,true)
on conflict (slug) do update set title_sr=excluded.title_sr,title_en=excluded.title_en,content_sr=excluded.content_sr,content_en=excluded.content_en,category=excluded.category,display_order=excluded.display_order,published=excluded.published,updated_at=now();
