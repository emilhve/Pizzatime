create table public.users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  role text not null default 'user' check (role in ('user', 'admin'))
);

create unique index users_username_lower_idx on public.users (lower(username));

alter table public.users enable row level security;
revoke all on table public.users from anon, authenticated;
grant select on table public.users to authenticated;
grant update (username) on table public.users to authenticated;

create policy "Users can read their own profile"
on public.users for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update their own username"
on public.users for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_username text := btrim(new.raw_user_meta_data ->> 'username');
  fallback_username text := 'user_' || replace(left(new.id::text, 12), '-', '');
begin
  if requested_username is null or requested_username !~ '^[A-Za-z0-9_]{3,24}$' then
    requested_username := fallback_username;
  end if;

  insert into public.users (user_id, username)
  values (new.id, requested_username)
  on conflict do nothing;

  if not found then
    insert into public.users (user_id, username)
    values (new.id, fallback_username);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.users (user_id, username)
select id, 'user_' || replace(left(id::text, 12), '-', '')
from auth.users
on conflict do nothing;

create table public.userratings (
  user_id uuid not null references public.users (user_id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  primary key (user_id, restaurant_id)
);

create index userratings_restaurant_id_idx on public.userratings (restaurant_id);

alter table public.userratings enable row level security;
revoke all on table public.userratings from anon, authenticated;
grant select, insert, delete on table public.userratings to authenticated;
grant update (rating) on table public.userratings to authenticated;

create policy "Users can read their own ratings"
on public.userratings for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add their own ratings"
on public.userratings for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own ratings"
on public.userratings for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can remove their own ratings"
on public.userratings for delete to authenticated
using ((select auth.uid()) = user_id);
