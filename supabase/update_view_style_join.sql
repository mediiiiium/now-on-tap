drop view if exists current_tap_lists;

create or replace view current_tap_lists as
select
  b.instagram_username,
  b.name              as bar_name,
  b.name_en           as bar_name_en,
  b.area,
  b.area_en,
  p.posted_at         as last_updated,
  p.post_url,
  br.name             as beer_name,
  br.brewery,
  br.style            as style_raw,
  s.name              as style,
  s.name_ja           as style_ja,
  s.category          as style_category,
  br.style_id,
  br.abv,
  br.price,
  br.notes
from bars b
left join lateral (
  select p2.id, p2.posted_at, p2.post_url
  from posts p2
  where p2.instagram_username = b.instagram_username
    and p2.is_tap_list = true
    and p2.posted_at > now() - interval '7 days'
  order by p2.posted_at desc
  limit 1
) p on true
left join beers br on br.post_id = p.id
left join styles s on s.id = br.style_id
where b.is_closed = false;
