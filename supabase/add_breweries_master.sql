-- Brewery master table
create table if not exists breweries (
  id serial primary key,
  name text not null unique,         -- 正式英語名（表示用）
  name_ja text,                      -- 日本語名
  prefecture text,                   -- 都道府県（日本のみ）
  country text default 'Japan',      -- 国
  website text,
  untappd_slug text,                 -- Untappd URL slug
  created_at timestamptz default now()
);

-- Alias table for fuzzy matching
create table if not exists brewery_aliases (
  id serial primary key,
  brewery_id integer not null references breweries(id) on delete cascade,
  alias text not null unique,
  created_at timestamptz default now()
);

-- RLS
alter table breweries enable row level security;
alter table brewery_aliases enable row level security;

drop policy if exists "public read breweries" on breweries;
drop policy if exists "public read brewery_aliases" on brewery_aliases;

create policy "public read breweries" on breweries for select using (true);
create policy "public read brewery_aliases" on brewery_aliases for select using (true);
