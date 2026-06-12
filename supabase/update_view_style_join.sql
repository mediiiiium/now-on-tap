drop view if exists current_tap_lists;

create or replace view current_tap_lists as
select
  b.instagram_username,
  b.name              as bar_name,
  b.name_en           as bar_name_en,
  b.area,
  b.area_en,
  b.website_url,
  b.google_maps_url,
  p.posted_at         as last_updated,
  p.post_url,
  p.caption,
  br.name             as beer_name,
  br.name_ja          as beer_name_ja,
  br.name_en          as beer_name_en,
  coalesce(bw.name,    br.brewery)    as brewery,
  coalesce(bw.name_ja, br.brewery)    as brewery_ja,
  coalesce(bw.name,    br.brewery_en, br.brewery) as brewery_en,
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
  select p2.id, p2.posted_at, p2.post_url, p2.caption
  from posts p2
  where p2.instagram_username = b.instagram_username
    and p2.is_tap_list = true
    and p2.posted_at > now() - interval '10 days'
  order by p2.posted_at desc
  limit 1
) p on true
left join beers br on br.post_id = p.id
left join styles s on s.id = br.style_id
left join breweries bw on bw.id = br.brewery_id
where b.status = 'active';
