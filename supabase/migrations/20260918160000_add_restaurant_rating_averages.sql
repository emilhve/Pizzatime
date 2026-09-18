create function public.get_restaurant_rating_averages()
returns table (
  restaurant_id uuid,
  average_rating numeric,
  rating_count bigint
)
language sql
stable
security definer set search_path = ''
as $$
  select
    ratings.restaurant_id,
    round(avg(ratings.rating)::numeric, 1) as average_rating,
    count(*) as rating_count
  from public.userratings as ratings
  group by ratings.restaurant_id;
$$;

revoke all on function public.get_restaurant_rating_averages() from public, anon, authenticated;
grant execute on function public.get_restaurant_rating_averages() to anon, authenticated;
