create or replace function replace_post_beers(
  p_post_id     integer,
  p_instagram   text,
  p_is_tap_list boolean,
  p_beers       jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from beers where post_id = p_post_id;

  if p_is_tap_list and jsonb_array_length(p_beers) > 0 then
    insert into beers (post_id, instagram_username, name, name_ja, name_en, brewery, brewery_en, style, abv, price, notes)
    select
      p_post_id,
      p_instagram,
      b->>'name',
      b->>'name_ja',
      b->>'name_en',
      b->>'brewery',
      b->>'brewery_en',
      b->>'style',
      b->>'abv',
      b->>'price',
      b->>'notes'
    from jsonb_array_elements(p_beers) as b;
  end if;

  update posts set is_tap_list = p_is_tap_list where id = p_post_id;
end;
$$;

revoke execute on function replace_post_beers from anon, authenticated;
