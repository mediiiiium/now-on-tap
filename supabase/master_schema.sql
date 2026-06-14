-- ブルワリーマスタ
create table if not exists breweries (
  id serial primary key,
  name_ja text,
  name_en text,
  prefecture text,
  created_at timestamptz default now()
);

-- ブルワリー表記ゆれテーブル
create table if not exists brewery_aliases (
  id serial primary key,
  brewery_id integer references breweries(id) on delete cascade,
  alias text not null unique,
  created_at timestamptz default now()
);

-- スタイルマスタ
create table if not exists styles (
  id serial primary key,
  name text not null unique,        -- 正式名称 (例: IPA)
  category text,                    -- カテゴリ (例: Hoppy, Dark, Sour)
  display_order integer default 99,
  created_at timestamptz default now()
);

-- スタイル表記ゆれテーブル
create table if not exists style_aliases (
  id serial primary key,
  style_id integer references styles(id) on delete cascade,
  alias text not null unique,
  created_at timestamptz default now()
);

-- beers テーブルに brewery_id, style_id を追加
alter table beers add column if not exists brewery_id integer references breweries(id);
alter table beers add column if not exists style_id integer references styles(id);

-- RLS（公開読み取り）
alter table breweries enable row level security;
alter table brewery_aliases enable row level security;
alter table styles enable row level security;
alter table style_aliases enable row level security;

drop policy if exists "public read breweries"       on breweries;
drop policy if exists "public read brewery_aliases" on brewery_aliases;
drop policy if exists "public read styles"          on styles;
drop policy if exists "public read style_aliases"   on style_aliases;

create policy "public read breweries"       on breweries       for select using (true);
create policy "public read brewery_aliases" on brewery_aliases for select using (true);
create policy "public read styles"          on styles          for select using (true);
create policy "public read style_aliases"   on style_aliases   for select using (true);
-- 書き込みはservice_role key経由のみ（RLSで匿名ユーザーへの書き込み権限は付与しない）

-- スタイルマスタ初期データ
insert into styles (name, category, display_order) values
  ('IPA',              'Hoppy',  1),
  ('Hazy IPA',         'Hoppy',  2),
  ('West Coast IPA',   'Hoppy',  3),
  ('Pale Ale',         'Hoppy',  4),
  ('Session IPA',      'Hoppy',  5),
  ('Pilsner',          'Lager',  10),
  ('Lager',            'Lager',  11),
  ('Helles',           'Lager',  12),
  ('Stout',            'Dark',   20),
  ('Porter',           'Dark',   21),
  ('Schwarzbier',      'Dark',   22),
  ('Saison',           'Belgian',30),
  ('Belgian Ale',      'Belgian',31),
  ('Witbier',          'Belgian',32),
  ('Wheat',            'Wheat',  40),
  ('Hefeweizen',       'Wheat',  41),
  ('Sour',             'Sour',   50),
  ('Gose',             'Sour',   51),
  ('Berliner Weisse',  'Sour',   52),
  ('Lambic',           'Sour',   53),
  ('Amber Ale',        'Malt',   60),
  ('Red Ale',          'Malt',   61),
  ('Brown Ale',        'Malt',   62),
  ('Barleywine',       'Strong', 70),
  ('Imperial Stout',   'Strong', 71),
  ('DIPA',             'Strong', 72),
  ('Fruit Beer',       'Other',  80),
  ('Spice/Herb',       'Other',  81),
  ('Cider',            'Other',  82),
  ('Nitro',            'Other',  83)
on conflict (name) do nothing;

-- スタイルエイリアス初期データ
insert into style_aliases (style_id, alias) values
  ((select id from styles where name='IPA'),            'India Pale Ale'),
  ((select id from styles where name='IPA'),            'ipa'),
  ((select id from styles where name='Hazy IPA'),       'HAZY IPA'),
  ((select id from styles where name='Hazy IPA'),       'Hazy Pale Ale'),
  ((select id from styles where name='Hazy IPA'),       'New England IPA'),
  ((select id from styles where name='Hazy IPA'),       'NEIPA'),
  ((select id from styles where name='Hazy IPA'),       'ヘイジーIPA'),
  ((select id from styles where name='West Coast IPA'), 'WCIPA'),
  ((select id from styles where name='West Coast IPA'), 'WC IPA'),
  ((select id from styles where name='West Coast IPA'), 'West Coast'),
  ((select id from styles where name='Pale Ale'),       'ペールエール'),
  ((select id from styles where name='Session IPA'),    'Session'),
  ((select id from styles where name='Pilsner'),        'ピルスナー'),
  ((select id from styles where name='Pilsner'),        'Pilsen'),
  ((select id from styles where name='Pilsner'),        'ピルス'),
  ((select id from styles where name='Lager'),          'lager'),
  ((select id from styles where name='Lager'),          'ラガー'),
  ((select id from styles where name='Stout'),          'stout'),
  ((select id from styles where name='Stout'),          'Milk Stout'),
  ((select id from styles where name='Stout'),          'MILK STOUT'),
  ((select id from styles where name='Stout'),          'Sweet Stout'),
  ((select id from styles where name='Stout'),          'スタウト'),
  ((select id from styles where name='Porter'),         'porter'),
  ((select id from styles where name='Porter'),         'ポーター'),
  ((select id from styles where name='Saison'),         'saison'),
  ((select id from styles where name='Saison'),         'セゾン'),
  ((select id from styles where name='Wheat'),          'wheat'),
  ((select id from styles where name='Wheat'),          'ヴァイツェン'),
  ((select id from styles where name='Wheat'),          'Weizen'),
  ((select id from styles where name='Wheat'),          'ホワイトエール'),
  ((select id from styles where name='Hefeweizen'),     'Hefeweizen'),
  ((select id from styles where name='Hefeweizen'),     'ヘーフェヴァイツェン'),
  ((select id from styles where name='Sour'),           'sour'),
  ((select id from styles where name='Sour'),           'サワー'),
  ((select id from styles where name='Gose'),           'ゴーゼ'),
  ((select id from styles where name='Amber Ale'),      'Amber'),
  ((select id from styles where name='Amber Ale'),      'amber'),
  ((select id from styles where name='Amber Ale'),      'アンバー'),
  ((select id from styles where name='Red Ale'),        'Red'),
  ((select id from styles where name='Imperial Stout'), 'Imperial'),
  ((select id from styles where name='DIPA'),           'Double IPA'),
  ((select id from styles where name='DIPA'),           'Imperial IPA'),
  ((select id from styles where name='Fruit Beer'),     'フルーツビール'),
  ((select id from styles where name='Fruit Beer'),     'Fruit')
on conflict (alias) do nothing;
