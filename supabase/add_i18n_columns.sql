-- ビューを先に削除（カラム追加後に再作成するため）
DROP VIEW IF EXISTS current_tap_lists;

-- ビール名・ブルワリー名の日英対応カラム追加
ALTER TABLE beers
  ADD COLUMN IF NOT EXISTS name_ja    text,   -- 日本語ビール名
  ADD COLUMN IF NOT EXISTS name_en    text,   -- 英語ビール名
  ADD COLUMN IF NOT EXISTS brewery_en text;   -- 英語ブルワリー名
  -- brewery は英語正規化済みのまま維持
  -- brewery_ja は brewery が日本語の場合そのまま使う

-- current_tap_lists ビューを再作成
CREATE VIEW current_tap_lists AS
SELECT
  b.instagram_username,
  b.name AS bar_name,
  b.area,
  p.posted_at AS last_updated,
  p.post_url,
  br.name      AS beer_name,
  br.name_ja   AS beer_name_ja,
  br.name_en   AS beer_name_en,
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

-- RLSポリシー再設定（ビューは不要だがテーブルは維持）
CREATE POLICY "public read beers" ON beers FOR SELECT USING (true);
