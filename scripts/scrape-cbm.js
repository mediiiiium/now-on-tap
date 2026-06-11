/**
 * CBM（Craft Beer Market）Webサイトからタップリスト画像を取得してDB保存
 * https://www.craftbeermarket.jp/todays-beer-list/
 * 東京店舗のみ対象
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const { extractBeers } = require('../analyzer/vision');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const TMP_DIR = path.join(__dirname, '../data/cbm_tmp');

// 東京店舗: CBMサイトのスラグ → instagram_username
const TOKYO_STORES = [
  { slug: 'toranomon',        username: 'cbm_toranomon' },
  { slug: 'jimbocho',         username: 'cbm_jimbocho' },
  { slug: 'mitsukoshimae',    username: 'cbm_mitsukoshimae' },
  { slug: 'kichijoji',        username: 'cbm_kichijoji' },
  { slug: 'otemachi',         username: 'cbm_otemachi' },
  { slug: 'kanda',            username: 'cbmkanda' },
  { slug: 'tamachi',          username: 'cbm_tamachi' },
  { slug: 'cbm-pennylane',    username: 'cbm_kichijoji_pennylane' },
  { slug: 'cbm-tokyo-torch',  username: 'cbm_tokyotorch' },
  { slug: 'cbm-tokyodomecity', username: 'cbm_tokyodomecity', prefix: 'beer' },
];

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function scrapeStore({ slug, username, prefix }) {
  const imgPrefix = prefix ?? 'dm';
  const imageUrl = `https://www.craftbeermarket.jp/todaysmenu/${imgPrefix}_${slug}.jpg`;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(/-/g, '');
  const postId = `cbm_${slug}_${today}`;

  // 既存チェック
  const { data: existing } = await supabase
    .from('posts')
    .select('id')
    .eq('post_id', postId)
    .single();
  if (existing) {
    console.log(`  ⏭  ${username} 保存済み`);
    return { skipped: true };
  }

  // 画像ダウンロード
  const tmpPath = path.join(TMP_DIR, `${slug}.jpg`);
  await downloadImage(imageUrl, tmpPath);

  // bars テーブルの last_scraped_at を更新
  await supabase
    .from('bars')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('instagram_username', username);

  // CBMは確実にタップリストなので分類をスキップして直接抽出
  const base64Image = fs.readFileSync(tmpPath).toString('base64');
  let beers = [];
  try {
    beers = await extractBeers(base64Image, null, 'image/jpeg');
  } catch (err) {
    console.log(`  ⚠️ ${username} ビール抽出失敗: ${err.message}`);
  }

  if (beers.length < 1) {
    console.log(`  ➖ ${username} ビール抽出0件`);
    await supabase.from('posts').insert({
      instagram_username: username,
      post_id: postId,
      post_url: 'https://www.craftbeermarket.jp/todays-beer-list/',
      posted_at: new Date().toISOString(),
      caption: null,
      is_tap_list: false,
    });
    return { is_tap_list: false };
  }

  // 投稿保存
  const { data: post, error: postError } = await supabase.from('posts').insert({
    instagram_username: username,
    post_id: postId,
    post_url: 'https://www.craftbeermarket.jp/todays-beer-list/',
    posted_at: new Date().toISOString(),
    caption: null,
    is_tap_list: true,
  }).select().single();
  if (postError) throw new Error(postError.message);

  // ビール保存
  for (const beer of beers) {
    await supabase.from('beers').insert({
      post_id: post.id,
      instagram_username: username,
      name: beer.name,
      name_ja: beer.name_ja ?? null,
      name_en: beer.name_en ?? null,
      brewery: beer.brewery ?? null,
      brewery_en: beer.brewery_en ?? null,
      style: beer.style ?? null,
      abv: beer.abv ?? null,
    });
  }

  console.log(`  ✅ ${username} タップリスト (${beers.length}ビール)`);
  return { is_tap_list: true, beerCount: beers.length };
}

async function main() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  console.log(`\n🍺 CBM スクレイプ開始 (${new Date().toLocaleString('ja-JP')})`);
  let total = 0, tapLists = 0, beers = 0;

  for (const store of TOKYO_STORES) {
    process.stdout.write(`  📥 ${store.username}... `);
    try {
      const result = await scrapeStore(store);
      if (!result.skipped) {
        total++;
        if (result.is_tap_list) { tapLists++; beers += result.beerCount; }
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  // 一時ファイル削除
  fs.rmSync(TMP_DIR, { recursive: true, force: true });

  console.log(`\n✅ 完了: ${total}店舗処理 / タップリスト${tapLists}件 / ビール${beers}件`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
