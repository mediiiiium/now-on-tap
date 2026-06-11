-- posts テーブルにキャプション保存カラム追加
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS caption text;

-- bars テーブルに英語名・英語エリアカラム追加
ALTER TABLE bars
  ADD COLUMN IF NOT EXISTS name_en  text,
  ADD COLUMN IF NOT EXISTS area_en  text;

-- current_tap_lists ビューを再作成（bars の新カラムを反映）
DROP VIEW IF EXISTS current_tap_lists;

CREATE VIEW current_tap_lists AS
SELECT
  b.instagram_username,
  b.name     AS bar_name,
  b.name_en  AS bar_name_en,
  b.area,
  b.area_en,
  p.posted_at AS last_updated,
  p.post_url,
  br.name        AS beer_name,
  br.name_ja     AS beer_name_ja,
  br.name_en     AS beer_name_en,
  br.brewery,
  br.brewery_en,
  br.style,
  br.abv,
  br.price,
  br.notes
FROM bars b
JOIN posts p ON p.instagram_username = b.instagram_username
  AND p.is_tap_list = true
  AND p.posted_at = (
    SELECT MAX(p2.posted_at)
    FROM posts p2
    WHERE p2.instagram_username = b.instagram_username
      AND p2.is_tap_list = true
  )
JOIN beers br ON br.post_id = p.id
WHERE p.posted_at > now() - INTERVAL '7 days';
