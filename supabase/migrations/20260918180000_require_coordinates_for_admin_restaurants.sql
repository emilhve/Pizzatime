grant insert (latitude, longitude) on public.restaurants to authenticated;

drop policy "Admins can add restaurants" on public.restaurants;

create policy "Admins can add restaurants"
on public.restaurants for insert to authenticated
with check (
  osm_id is null
  and nullif(btrim(name), '') is not null
  and nullif(btrim(address), '') is not null
  and latitude between 45.392531 and 45.415025
  and longitude between 11.866006 and 11.897938
  and exists (
    select 1 from public.users
    where user_id = (select auth.uid())
      and role = 'admin'
  )
);
