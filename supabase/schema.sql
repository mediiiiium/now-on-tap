-- バー一覧
create table if not exists bars (
  id serial primary key,
  instagram_username text unique not null,
  name text,
  name_en text,        -- 英語バー名（英語サイト向け）
  area text,           -- エリア名（日本語）
  area_en text,        -- エリア名（英語）
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
  caption text,        -- Instagramキャプションテキスト
  is_tap_list boolean default false,
  scraped_at timestamptz default now()
);

-- 抽出されたビール
create table if not exists beers (
  id serial primary key,
  post_id integer references posts(id) on delete cascade,
  instagram_username text not null,
  name text,           -- ビール名（画像の表記のまま）
  name_ja text,        -- 日本語ビール名
  name_en text,        -- 英語ビール名
  brewery text,        -- ブルワリー名（英語正規化済み）
  brewery_en text,     -- 英語ブルワリー名（normalize-breweries.js で設定）
  style text,          -- ビアスタイル（英語正規化済み）
  abv text,            -- アルコール度数
  price text,          -- 価格
  notes text,          -- その他メモ
  created_at timestamptz default now()
);

-- タップリスト最新状態ビュー（bar単位で最新投稿のビールを取得）
create or replace view current_tap_lists as
select
  b.instagram_username,
  b.name     as bar_name,
  b.name_en  as bar_name_en,
  b.area,
  b.area_en,
  p.posted_at as last_updated,
  p.post_url,
  br.name        as beer_name,
  br.name_ja     as beer_name_ja,
  br.name_en     as beer_name_en,
  br.brewery,
  br.brewery_en,
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

-- RLS
alter table bars enable row level security;
alter table posts enable row level security;
alter table beers enable row level security;

create policy "public read bars" on bars for select using (true);
create policy "public read posts" on posts for select using (true);
create policy "public read beers" on beers for select using (true);
