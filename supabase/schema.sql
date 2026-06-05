-- バー一覧
create table if not exists bars (
  id serial primary key,
  instagram_username text unique not null,
  name text,
  area text,
  created_at timestamptz default now()
);

-- スクレイプした投稿
create table if not exists posts (
  id serial primary key,
  bar_id integer references bars(id),
  instagram_username text not null,
  post_id text unique not null,
  post_url text,
  posted_at timestamptz,
  is_tap_list boolean default false,
  scraped_at timestamptz default now()
);

-- 抽出されたビール
create table if not exists beers (
  id serial primary key,
  post_id integer references posts(id) on delete cascade,
  instagram_username text not null,
  name text,
  brewery text,
  style text,
  abv text,
  price text,
  notes text,
  created_at timestamptz default now()
);

-- タップリスト最新状態ビュー（bar単位で最新投稿のビールを取得）
create or replace view current_tap_lists as
select
  b.instagram_username,
  b.name as bar_name,
  b.area,
  p.posted_at as last_updated,
  p.post_url,
  br.name as beer_name,
  br.brewery,
  br.style,
  br.abv,
  br.price,
  br.notes
from bars b
join posts p on p.instagram_username = b.instagram_username
  and p.is_tap_list = true
  and p.posted_at = (
    select max(p2.posted_at)
    from posts p2
    where p2.instagram_username = b.instagram_username
      and p2.is_tap_list = true
  )
join beers br on br.post_id = p.id
where p.posted_at > now() - interval '7 days';

-- RLS無効（まずシンプルに）
alter table bars enable row level security;
alter table posts enable row level security;
alter table beers enable row level security;

create policy "public read bars" on bars for select using (true);
create policy "public read posts" on posts for select using (true);
create policy "public read beers" on beers for select using (true);
