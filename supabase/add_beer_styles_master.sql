-- ビアスタイルマスタ
CREATE TABLE IF NOT EXISTS beer_styles (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL,       -- 正規化スタイル名（beers.styleに使う値）
  group_name text NOT NULL,        -- フィルタ用グループ名
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE beer_styles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read beer_styles" ON beer_styles FOR SELECT USING (true);

-- マスタデータ投入
INSERT INTO beer_styles (name, group_name) VALUES

-- IPA
('IPA', 'IPA'),
('American IPA', 'IPA'),
('Cold IPA', 'IPA'),
('Session IPA', 'IPA'),
('Double IPA', 'IPA'),
('DIPA', 'IPA'),
('Imperial IPA', 'IPA'),
('Sour IPA', 'IPA'),
('DDH IPA', 'IPA'),
('Fruit Sour IPA', 'IPA'),
('IPA - American', 'IPA'),
('IPA - Sour', 'IPA'),

-- Hazy IPA
('Hazy IPA', 'Hazy IPA'),
('Hazy Double IPA', 'Hazy IPA'),
('Imperial Hazy DIPA', 'Hazy IPA'),
('IPA - Imperial / Double New England / Hazy', 'Hazy IPA'),
('IPA - Triple New England / Hazy', 'Hazy IPA'),
('IPA - Imperial / Double', 'Hazy IPA'),
('Murky IPA', 'Hazy IPA'),

-- West Coast IPA
('West Coast IPA', 'West Coast IPA'),
('WCIPA', 'West Coast IPA'),
('DDH West Coast IPA', 'West Coast IPA'),
('Frozen Fresh Hop WCIPA', 'West Coast IPA'),

-- Pale Ale
('Pale Ale', 'Pale Ale'),
('Hazy Pale Ale', 'Pale Ale'),
('Pale Ale - New England / Hazy', 'Pale Ale'),
('APA', 'Pale Ale'),
('Japanese Pale Ale', 'Pale Ale'),
('English Pale Ale', 'Pale Ale'),
('Belgian Pale Ale', 'Pale Ale'),
('Strong Golden Ale', 'Pale Ale'),
('Amber Ale', 'Pale Ale'),
('アンバーエール', 'Pale Ale'),
('Red Ale', 'Pale Ale'),
('Golden Ale', 'Pale Ale'),

-- Lager
('Lager', 'Lager'),
('Dark Lager', 'Lager'),
('Dry Lager', 'Lager'),
('Mexican Lager', 'Lager'),
('Lager - Japanese Rice', 'Lager'),
('Dortmunder', 'Lager'),

-- Pilsner
('Pilsner', 'Pilsner'),
('Czech Pilsner', 'Pilsner'),
('German Pilsner', 'Pilsner'),
('Italian Pilsner', 'Pilsner'),
('Bohemian Style Pilsner', 'Pilsner'),
('West Coast Pilsner', 'Pilsner'),
('Neon Pilsner', 'Pilsner'),

-- Helles
('Helles', 'Helles'),

-- Kölsch
('Kölsch', 'Kölsch'),

-- Stout & Porter
('Stout', 'Stout & Porter'),
('Imperial Stout', 'Stout & Porter'),
('Milk Stout', 'Stout & Porter'),
('Witbier', 'Stout & Porter'),
('Porter', 'Stout & Porter'),
('Honey Porter', 'Stout & Porter'),
('Baltic Porter', 'Stout & Porter'),

-- Wheat & White
('Hefeweizen', 'Wheat & White'),
('Weizen', 'Wheat & White'),
('Belgian Wit', 'Wheat & White'),
('Belgian White', 'Wheat & White'),
('White Ale', 'Wheat & White'),
('White', 'Wheat & White'),
('Rye Beer', 'Wheat & White'),

-- Sour
('Sour', 'Sour'),
('Sour Ale', 'Sour'),
('Wild Ale with Fruits', 'Sour'),
('Fruit Sour Ale w/ Vanilla', 'Sour'),
('Smoothie Sour Ale', 'Sour'),
('Gose', 'Sour'),
('Berliner Weisse', 'Sour'),
('Hopped Cyser', 'Sour'),

-- Belgian
('Tripel', 'Belgian'),
('Belgian Strong Ale', 'Belgian'),
('Dubbel', 'Belgian'),
('Quad', 'Belgian'),

-- Saison
('Saison', 'Saison'),
('Farmhouse Ale - Saison', 'Saison'),
('Hoppy Saison', 'Saison'),
('Saison w/Yuzu & Sorachi Ace', 'Saison'),
('Saison with はちみつ', 'Saison'),
('Oak Chip Infused Farmhouse Ale', 'Saison'),
('Fruit Ale', 'Saison'),

-- Bitter
('Bitter', 'Bitter'),
('English Bitter', 'Bitter'),
('Best Bitter', 'Bitter'),
('English Mild', 'Bitter'),

-- Cider
('Cider', 'Cider'),
('English Cider', 'Cider'),
('Cidre', 'Cider'),

-- Seltzer
('Hard Seltzer', 'Seltzer'),
('Seltzer', 'Seltzer'),

-- Other（マッピング先が不明なものの受け皿）
('Ale', 'Other'),
('Spice IPA', 'Other');
