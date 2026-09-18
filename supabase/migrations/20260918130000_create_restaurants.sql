create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  osm_id text not null unique,
  name text not null,
  address text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180)
);

alter table public.restaurants enable row level security;

revoke all on table public.restaurants from anon, authenticated;
grant select on table public.restaurants to anon, authenticated;

drop policy if exists "Restaurants are publicly readable" on public.restaurants;

create policy "Restaurants are publicly readable"
on public.restaurants
for select
to anon, authenticated
using (true);
