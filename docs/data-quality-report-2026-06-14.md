# Now on Tap データ品質レポート (2026-06-14)

## テーブルサマリ

| テーブル | 件数 |
|----------|------|
| bars | 225 |
| posts | 352 |
| beers | 1,168 |
| breweries | 1,105 |
| styles | 42 |
| brewery_aliases | 63 |
| style_aliases | 149 |

## 問題点（重要度順）

### 1. bars: name=NULL が 144/225件 (64%)
active 含め大半の bar に表示名がない。フロントエンド表示で instagram_username がそのまま出ている可能性。

### 2. beers.brewery → breweries.name 未マッチ: 186種類
日本語ブルワリー名（`富士桜高原麦酒`、`志賀高原ビール`）や省略表記（`Minoh.B`、`WestCoast.B`）が breweries マスタにマッチしない。brewery_aliases の 63件は不十分 — 未マッチ 186種に対してカバレッジが低い。

### 3. beers.style → styles.name 未マッチ: 139種類
`Hazy Pale Ale`、`Weizen`、`White Ale` など style_aliases に登録済みのはずのものも未マッチ。beers.style テキストが正規化前の値のまま残っている（style_id 紐付け時に style テキストは書き換えていない？）。

### 4. beers: マスタ紐付け率
- brewery_id: 73%（27% 未紐付け）
- style_id: 75%（25% 未紐付け）

### 5. beers: 重複 6組
同一 post_id + name の重複あり（`ピルスナー`、`ヴァイツェン` 等）。Vision API の抽出ミスまたはリトライによる二重保存の可能性。

### 6. posts: bar_id=NULL が 42/352件 (12%)
CBM/iBrew スクリプトが bar_id を設定していなかった名残。RPC 修正（72d8aa7）で新規分は解消予定。

### 7. breweries: name_en が全件 NULL (1,000/1,000)
英語名カラムが完全未使用。

### 8. active bars: last_scraped_at=NULL が多数
`baldys_goodbeer` 等、active だが一度もスクレイプされていないアカウントが存在。inactive 候補の可能性。

### 9. beers: price=NULL 96%, notes=NULL 88%
ほぼ空。CBM/iBrew ソースでは価格情報がないため想定通りだが、Instagram 経由でも抽出率が低い。

## 対処優先度

1. **brewery_aliases 拡充** — 未マッチ 186種のうち頻出パターンを登録
2. **style_aliases 拡充 + beers.style 正規化** — 未マッチ 139種を解消
3. **bars.name 補完** — 少なくとも active bars の表示名を埋める
4. **beers 重複の調査・削除** — 6組のデデュプ
5. **posts.bar_id バックフィル** — 既存42件の NULL を埋める
