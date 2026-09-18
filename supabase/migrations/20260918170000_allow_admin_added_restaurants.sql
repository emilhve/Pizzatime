alter table public.restaurants alter column osm_id drop not null;
alter table public.restaurants alter column latitude drop not null;
alter table public.restaurants alter column longitude drop not null;

grant insert (name, address) on public.restaurants to authenticated;

create policy "Admins can add restaurants"
on public.restaurants for insert to authenticated
with check (
  osm_id is null
  and latitude is null
  and longitude is null
  and nullif(btrim(name), '') is not null
  and nullif(btrim(address), '') is not null
  and exists (
    select 1 from public.users
    where user_id = (select auth.uid())
      and role = 'admin'
  )
);
