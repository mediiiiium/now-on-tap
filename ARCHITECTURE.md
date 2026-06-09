# Now On Tap — アーキテクチャ & 設計メモ

> ビールバーのInstagram投稿を自動収集・解析し、現在のタップリストをリアルタイム表示するサービス。
> バー側の作業ゼロ（普通にInstagramに投稿するだけ）。

---

## コンセプト

```
バーがInstagramに投稿
      ↓
専用アカウント @now_on_tap がフォローしているバーのフィードをキャッチ
      ↓
Claude Vision API で画像を解析 → ビール情報を構造化データとして抽出
      ↓
Supabase（PostgreSQL）に保存
      ↓
nowontap.mediiiiium.com に表示
```

---

## システム全体像

```
[GitHub Actions]
  ├── 毎日 JST 10:00  pipeline.js        ← フィードスクレイプ → Vision解析 → DB保存 → Cloudflareデプロイ
  ├── 手動トリガー    pipeline.js        ← GitHub UIの「Run workflow」ボタン
  └── (毎週金 alert-report.js)           ← 異常アカウントの診断レポートをSlackへ（検討中）

[Cloudflare Pages]
  └── nowontap.mediiiiium.com            ← Next.js static export
                                            ビルド時にSupabaseからデータ取得→静的HTML化

[Supabase (PostgreSQL)]
  ├── bars               店舗マスタ
  ├── posts              スクレイプした投稿
  ├── beers              投稿から抽出したビール情報
  ├── breweries          ブルワリーマスタ（725件）
  ├── brewery_aliases    ブルワリー表記ゆれ
  ├── styles             ビアスタイルマスタ（34件）
  ├── style_aliases      スタイル表記ゆれ（100件超）
  └── current_tap_lists  ビュー ← 7日以内の最新タップリストのみ返す

[Slack]
  └── エラー発生時に通知
```

---

## スケジューリング

GitHub Actions（`.github/workflows/pipeline.yml`）で管理。
Mac不要、クラウド上で完結する。

```yaml
on:
  schedule:
    - cron: '0 1 * * *'   # 毎日 JST 10:00
  workflow_dispatch:        # GitHub UI から手動実行
```

パイプライン完了後、Cloudflare Deploy Hook を叩いてフロントを自動再デプロイ。

### セッションの扱い

`data/session.json`（Instagramの認証情報）はGitにコミットしない。
GitHub Secrets に `INSTAGRAM_SESSION_JSON` として登録し、実行時にファイルとして書き出す。

```yaml
- name: Write session.json
  run: echo '${{ secrets.INSTAGRAM_SESSION_JSON }}' > data/session.json
```

セッションが切れた場合はローカルで `node scraper/enter-code.js` を実行して再認証し、
新しい `session.json` の内容でSecretを更新する。

---

## データフロー詳細

### 毎日: pipeline.js

```
scrapeFeed(8)
  └─→ 新規投稿リスト
        ↓ for each
        upsertBar(username)    bars テーブルに店舗登録（なければ）
        analyzeTapList(image)  Vision API で解析
        savePost(...)          posts + beers テーブルに保存
        ↓
      エラーが1件でもあれば Slack 通知
        ↓
      Cloudflare Deploy Hook を叩いて再デプロイ
```

スクロール回数 `scrollCount = 8` は、1回のスクロールで画面1〜2件の投稿が表示される想定で、
約16〜20件をカバーできる量。

### alert-report.js（週次・任意実行）

DBの全投稿データを集計し、アカウントごとに診断する。

```
posts テーブル 全件取得
  ↓ アカウント単位で集計
  ├─ totalPosts     : 総投稿数
  ├─ tapListPosts   : タップリストとして検出された投稿数
  ├─ tapListRate    : 検出率（%）
  ├─ lastPost       : 最後にスクレイプした投稿日
  └─ lastTapList    : 最後にタップリストを検出した日

  ↓ 診断ロジック
  │ 最近投稿あり & タップリスト1ヶ月以上未検出
  │   → 🔴 Visionロジック or 投稿フォーマット変化の可能性
  │ 投稿自体が30日以上なし
  │   → 😴 休止中の可能性 → フォロー外し検討
  └─ 投稿3件以上あるがタップリスト検出率0%
      → ⚠️ タップリスト投稿していないアカウントの可能性

  ↓ Slackに送信
  要確認アカウント（Instagram URLつき）と正常アカウント一覧
```

---

## スクレイピングの仕組み

### セッション管理

Playwright（Chromiumベース）でInstagramにログインし、セッション情報を `data/session.json` に保存する。
以降はこのファイルを `storageState` として読み込むことでログイン済み状態を再現できる。
通常、数週間〜数ヶ月は有効。

```js
const context = await browser.newContext({
  storageState: SESSION_FILE,   // Cookie + localStorage を再現
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
  viewport: { width: 1280, height: 900 },
});
```

### フィードベーススクレイピング（feed.js）

個別アカウントを毎日53件巡回するのではなく、@now_on_tap のホームフィードを読む方式。

```
1. https://www.instagram.com/ を開く（ログイン済みフィード）
2. scrollCount 回スクロール（1回 = 画面2枚分）
3. a[href*="/p/"], a[href*="/reel/"] を収集（重複除外）
4. 各投稿ページに移動:
   ├─ username取得: header a[href^="/"] から /username/ 形式のみ抽出
   ├─ postedAt取得: <time datetime="..."> から取得
   └─ screenshot: <main> 要素全体をPNG保存
5. フィードに戻って次のスクロールへ
```

### ユーザー名抽出の工夫

正規表現 `/^\/[a-zA-Z0-9_.]+\/$/` で `/username/` 形式のみに絞り、予約語リストで除外。

```js
if (href && /^\/[a-zA-Z0-9_.]+\/$/.test(href) &&
    !['p', 'reels', 'explore', 'stories', 'tv', 'reel'].includes(href.replace(/\//g, ''))) {
  return href.replace(/\//g, '');
}
```

### セッション再認証（enter-code.js）

Instagramが新しいデバイスを検知するとメール確認コードを要求してくる。
`enter-code.js` はその確認コードを手動で入力してセッションを更新するための1回限りのスクリプト。

```bash
node scraper/enter-code.js
# → ブラウザが起動 → メールに確認コード → 入力 → session.json 更新
# → GitHub Secrets の INSTAGRAM_SESSION_JSON も更新する
```

---

## Vision API の解析ロジック

### 概要

Claude Vision API（`claude-haiku-4-5`）にスクリーンショットを送り、
タップリストかどうかの判定とビール情報の抽出を一括で行う。
haiku を使う理由はコスト（opus/sonnetの1/10以下）で、精度は実用上問題なし。

### 検出精度と限界

| ケース | 精度 |
|--------|------|
| 黒板に書かれたタップリスト | △ 手書き文字は読み取りにくい場合あり |
| 画像テキストのタップリスト | ◎ ほぼ正確 |
| 食べ物・風景の写真 | ◎ is_tap_list: false を正しく返す |
| 複数枚投稿（カルーセル） | △ 現在は1枚目のみ |
| 動画（リール） | △ サムネイルのみ解析 |

---

## データベース設計

### テーブル構成

```
bars
  id                serial PK
  instagram_username text UNIQUE NOT NULL
  name              text                     ← 日本語店舗名（手動管理）
  name_en           text                     ← 英語店舗名（手動管理）
  area              text                     ← エリア（日本語）
  area_en           text                     ← エリア（英語）
  created_at        timestamptz

posts
  id                serial PK
  bar_id            integer FK → bars.id
  instagram_username text NOT NULL
  post_id           text UNIQUE NOT NULL     ← 重複保存防止
  post_url          text
  posted_at         timestamptz
  is_tap_list       boolean
  scraped_at        timestamptz

beers
  id                serial PK
  post_id           integer FK → posts.id ON DELETE CASCADE
  instagram_username text NOT NULL
  name              text
  brewery           text                     ← Vision APIの生テキスト
  brewery_id        integer FK → breweries.id  ← マスタ紐付け（任意）
  style             text                     ← Vision APIの生テキスト
  style_id          integer FK → styles.id   ← マスタ紐付け（エイリアス経由）
  abv               text
  price             text
  notes             text
  created_at        timestamptz

breweries
  id                serial PK
  name_ja           text
  name_en           text
  prefecture        text
  created_at        timestamptz

brewery_aliases
  id                serial PK
  brewery_id        integer FK → breweries.id
  alias             text UNIQUE NOT NULL

styles                                       ← 34スタイル
  id                serial PK
  name              text UNIQUE NOT NULL     ← 英語正式名（例: IPA, Hazy IPA）
  name_ja           text                     ← 日本語名（例: ヘイジーIPA）
  category          text                     ← Hoppy / Dark / Sour / Belgian など
  display_order     integer

style_aliases                                ← 100件超
  id                serial PK
  style_id          integer FK → styles.id
  alias             text UNIQUE NOT NULL     ← Vision APIの生出力をマッピング
```

### スタイルマスタの仕組み

Vision APIが返す生のスタイル文字列（例: "American IPA", "WCIPA", "Hazy Pale Ale"）を
`style_aliases` テーブル経由でマスタに正規化する。

```
beers.style = "American IPA"
  → style_aliases.alias で検索
  → style_id = styles["IPA"].id
  → beers.style_id に保存
```

マッチしないもの（ビール名、無意味な文字列）は `style_id = null` のまま保持。

### current_tap_lists ビュー

```sql
select
  b.instagram_username, b.name as bar_name, b.name_en as bar_name_en,
  b.area, b.area_en,
  p.posted_at as last_updated, p.post_url,
  br.name as beer_name, br.brewery, br.style, br.style_id, br.abv, br.price, br.notes
from bars b
join posts p on p.instagram_username = b.instagram_username
  and p.is_tap_list = true
  and p.posted_at = (
    select max(p2.posted_at) from posts p2
    where p2.instagram_username = b.instagram_username
      and p2.is_tap_list = true
  )
join beers br on br.post_id = p.id
where p.posted_at > now() - interval '7 days';
```

7日以内のみ表示：タップリストは週単位で更新されることが多く、それ以上古い情報は「今のタップ」として不正確なため。

---

## フロントエンド

### 表示ルール

- 表示対象: `current_tap_lists` が返す店舗のみ（7日以内にタップリスト投稿がある店）
- ソート: `last_updated` 降順
- フィルタ: エリアチップ / スタイルチップ / ブルワリーテキスト検索

### 静的エクスポートの仕組み

Next.js の `output: 'export'` でビルド時にSupabaseからデータ取得→静的HTML生成。

```
GitHub Actions pipeline 完了
  ↓ Cloudflare Deploy Hook を叩く
  ↓ Cloudflare Pages がビルド開始（getTapLists() → Supabase SELECT）
  ↓ 静的HTML生成 → nowontap.mediiiiium.com に反映
```

データ更新 = 再デプロイが必要（ISR非対応）。`revalidate` はstatic exportでは効かない。

---

## 多言語対応（JP/EN）

将来の外国人向け対応に備え、英語カラムを先行して保持している。

| テーブル | 日本語 | 英語 |
|---|---|---|
| bars | name | name_en |
| bars | area | area_en |
| styles | name（英語が正） | name_ja |
| breweries | name_ja | name_en |

フロントの言語切り替えUIは未実装。DBの準備のみ完了。

---

## 運用・障害対応

### Instagramセッション切れ

**症状**: スクレイパーがログイン画面にリダイレクト、またはフィードが取得できない。

**対応手順**:
```bash
node scraper/enter-code.js
# session.json 更新後、GitHub Secrets の INSTAGRAM_SESSION_JSON も更新する
```

### ビール情報が取れない店舗の調査

週次アラートで「🔴 最近投稿あり、でもタップリスト未検出」が出た場合：

1. InstagramのリンクをSlackから確認
2. 実際の投稿でタップリストが画像に含まれているか確認
3. 含まれている → Vision APIの精度問題 → プロンプト改善を検討
4. 含まれていない → タップリストを画像で投稿していない → フォロー外し検討

---

## ファイル構成

```
now-on-tap/
├── pipeline.js                  メインオーケストレーション
├── .env                         環境変数（gitignore済み）
├── ARCHITECTURE.md              このファイル
│
├── .github/workflows/
│   └── pipeline.yml             GitHub Actions（定期実行 + 手動実行）
│
├── scraper/
│   ├── feed.js                  フィードスクレイパー（メイン）
│   ├── following.js             フォローリスト取得
│   ├── instagram.js             個別アカウントスクレイパー
│   ├── all-accounts.js          全アカウント巡回
│   └── enter-code.js            セッション再認証
│
├── analyzer/
│   └── vision.js                Claude Vision APIでタップリスト解析
│
├── db/
│   └── supabase.js              DB操作（upsertBar, savePost）
│
├── scripts/
│   ├── alert-report.js          週次アラートレポート → Slack
│   ├── seed-style-aliases.js    スタイルエイリアス投入
│   ├── seed-breweries.js        ブルワリーマスタ投入
│   └── import-bars-name-en.js   バー英語名CSV取り込み
│
├── supabase/
│   ├── schema.sql               基本テーブル定義・ビュー・RLS
│   ├── master_schema.sql        マスタテーブル定義（breweries, styles等）
│   └── i18n_columns.sql         多言語カラム追加
│
└── data/
    ├── session.json             Instagramセッション（gitignore済み）
    ├── screenshots/             スクリーンショット一時保存（gitignore済み）
    ├── breweries_master.json    725ブルワリーのマスタデータ
    └── bars_name_en_template.csv バー英語名テンプレート（作業用）
```

---

## 環境変数

### バックエンド（.env / GitHub Secrets）

| 変数 | 用途 |
|------|------|
| `INSTAGRAM_SESSION_JSON` | session.jsonの中身（GitHub Secretsのみ） |
| `ANTHROPIC_API_KEY` | Claude Vision API |
| `SUPABASE_URL` | Supabase URL |
| `SUPABASE_SERVICE_KEY` | DB書き込み用 |
| `SLACK_WEBHOOK_URL` | エラー通知 |
| `CLOUDFLARE_DEPLOY_HOOK` | 再デプロイWebhook |

### フロントエンド（frontend/.env.local & Cloudflare Pages）

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 読み取り専用キー |

---

## コスト

| サービス | プラン | 費用目安 |
|----------|--------|----------|
| Claude Vision（haiku-4-5） | 従量課金 | 約$0.001/枚 × 月1,500枚 ≈ **月$1.5** |
| Supabase | Free tier | 無料（500MB / 50,000 rows） |
| Cloudflare Pages | Free tier | 無料 |
| GitHub Actions | Free tier | 無料（月2,000分まで） |
