create or replace function save_post_with_beers(
  p_bar_id        integer,
  p_instagram     text,
  p_post_id       text,
  p_post_url      text,
  p_posted_at     timestamptz,
  p_caption       text,
  p_is_tap_list   boolean,
  p_beers         jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post_id integer;
begin
  insert into posts (bar_id, instagram_username, post_id, post_url, posted_at, caption, is_tap_list)
  values (p_bar_id, p_instagram, p_post_id, p_post_url, p_posted_at, p_caption, p_is_tap_list)
  returning id into v_post_id;

  if p_is_tap_list and jsonb_array_length(p_beers) > 0 then
    insert into beers (post_id, instagram_username, name, name_ja, name_en, brewery, brewery_en, style, abv, price, notes)
    select
      v_post_id,
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

  return v_post_id;
end;
$$;

revoke execute on function save_post_with_beers from anon, authenticated;
