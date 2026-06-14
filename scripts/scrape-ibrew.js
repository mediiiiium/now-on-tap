/**
 * iBrew 各店舗のタップリストを取得してDB保存
 * - ibrew_ginza / shinbashiibrew: Google Sheets pubhtml (2行ペア形式)
 * - ibrew_ebisu_official: 独自Webサイト (テキスト形式)
 */
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const STORES = [
  {
    username: 'ibrew_ginza',
    type: 'sheets',
    url: 'https://docs.google.com/spreadsheets/u/1/d/e/2PACX-1vQKO-c7sjN0VA4sSYsWUGxbhTn_EK7vQbUATlzT12F28GsEamymWRz3yfyDaqbUh71KIQHdCLqlXRc7/pubhtml/sheet?headers=false&gid=383383677',
  },
  {
    username: 'shinbashiibrew',
    type: 'sheets',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQqVbkGjw5FoHXPP16gLT0m8G8LORmeN3dRE5bSLOGzQHqYJm4VN_Saodc54HVfLcg7GZA5Wz_T80ab/pubhtml/sheet?headers=false&gid=299362418',
  },
  {
    username: 'ibrew_akihabara',
    type: 'sheets_akihabara',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTnrHxBPrds2E-y9aseFIvYCW5FewSoXTah2j-5pIpaDSt1m9K8EON1wrtq9ObZE_4qf-Oci_iE6xhn/pubhtml/sheet?headers=false&gid=0',
  },
  {
    username: 'ibrew_ebisu_official',
    type: 'web',
    url: 'https://menu.craftbeerbar-ibrew.com/ebisu-menu/todays-beer/',
  },
];

// Google Sheets pubhtml から2行ペアでビールを抽出
async function extractFromSheets(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const rows = await page.evaluate(() =>
    Array.from(document.querySelectorAll('table tr')).map(r =>
      Array.from(r.querySelectorAll('td,th')).map(c => c.textContent.trim())
    )
  );

  const beers = [];
  let pendingBrewery = null;

  for (const row of rows) {
    const nonempty = row.filter(c => c);
    if (nonempty.length < 2) continue;

    // ブルワリー行: col[2]が数字、col[5]にブルワリー名
    const beerNo = row[2]?.trim();
    const brewery = row[5]?.trim();
    if (beerNo && /^[０-９0-9]+$/.test(beerNo.replace(/[１２３４５６７８９０]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))) && brewery) {
      pendingBrewery = brewery;
      continue;
    }

    // ビール行: col[3]にビール名、col[4]にスタイル
    const name = row[3]?.trim();
    const style = row[4]?.trim();
    if (name && pendingBrewery) {
      beers.push({
        name,
        name_ja: null,
        name_en: null,
        brewery: pendingBrewery,
        brewery_en: null,
        style: style || null,
        abv: null,
      });
      pendingBrewery = null;
    }
  }

  return beers;
}

// 秋葉原: col[2]=ブルワリー名、col[3]="番号.ビール名"、次行col[2]=スタイル+ABV
async function extractFromSheetsAkihabara(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const rows = await page.evaluate(() =>
    Array.from(document.querySelectorAll('table tr')).map(r =>
      Array.from(r.querySelectorAll('td,th')).map(c => c.textContent.trim())
    )
  );

  const beers = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const col2 = row[2]?.trim() || '';
    const col3 = row[3]?.trim() || '';

    // ビール行: col[3] が "数字.ビール名" 形式
    if (/^\d+[\.\．]/.test(col3)) {
      const name = col3.replace(/^\d+[\.\．]\s*/, '');
      // 前の行または同じ行のcol[2]がブルワリー名（スタイル行でなければ）
      const brewery = col2 && !/^\d+\.?\d*%/.test(col2) ? col2 : null;
      // 次の行のcol[2]がスタイル+ABV
      const nextCol2 = rows[i + 1]?.[2]?.trim() || '';
      const abvMatch = nextCol2.match(/(\d+\.?\d*)%/);
      const abv = abvMatch ? `${abvMatch[1]}%` : null;
      const style = nextCol2.replace(/\d+\.?\d*%.*/, '').trim() || null;

      if (name) beers.push({ name, name_ja: null, name_en: null, brewery, brewery_en: null, style, abv });
    }
  }

  return beers;
}

// 恵比寿Webサイトからテキスト形式でビールを抽出
async function extractFromWeb(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const text = await page.evaluate(() => document.body.innerText);
  const beers = [];

  // パターン: カテゴリ行 → 番号 → ブルワリー → ビール名 → スタイル+ABV+産地
  // 番号行（数字のみ）を目印にパース
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  for (let i = 0; i < lines.length; i++) {
    // 数字のみの行 = ビール番号
    if (!/^\d+$/.test(lines[i])) continue;

    const brewery = lines[i + 1];
    const name = lines[i + 2];
    const detailLine = lines[i + 3] ?? '';

    if (!brewery || !name) continue;
    // detailLine例: "Hazy IPA 6.5% USA"
    const abvMatch = detailLine.match(/(\d+\.?\d*)%/);
    const abv = abvMatch ? `${abvMatch[1]}%` : null;
    // スタイルはABV前の部分
    const stylePart = detailLine.replace(/\d+\.?\d*%.*/, '').trim() || null;

    beers.push({
      name,
      name_ja: null,
      name_en: null,
      brewery,
      brewery_en: null,
      style: stylePart,
      abv,
    });

    i += 3;
  }

  return beers;
}

async function saveStore(username, beers) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(/-/g, '');
  const postId = `ibrew_${username}_${today}`;

  const { data: existing } = await supabase.from('posts').select('id').eq('post_id', postId).single();
  if (existing) { console.log(`  ⏭  ${username} 保存済み`); return { skipped: true }; }

  if (beers.length === 0) {
    console.log(`  ➖ ${username} ビール取得0件`);
    await supabase.from('posts').insert({
      instagram_username: username, post_id: postId,
      post_url: 'https://www.instagram.com/' + username + '/',
      posted_at: new Date().toISOString(), caption: null, is_tap_list: false,
    });
    return { is_tap_list: false };
  }

  const { data: bar } = await supabase.from('bars').update({ last_scraped_at: new Date().toISOString() }).eq('instagram_username', username).select('id').single();

  const { error } = await supabase.rpc('save_post_with_beers', {
    p_bar_id: bar?.id ?? null,
    p_instagram: username,
    p_post_id: postId,
    p_post_url: 'https://www.instagram.com/' + username + '/',
    p_posted_at: new Date().toISOString(),
    p_caption: null,
    p_is_tap_list: true,
    p_beers: beers,
  });
  if (error) throw new Error(error.message);

  console.log(`  ✅ ${username} タップリスト (${beers.length}ビール)`);
  return { is_tap_list: true, beerCount: beers.length };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`\n🍺 iBrew スクレイプ開始 (${new Date().toLocaleString('ja-JP')})`);
  let total = 0, tapLists = 0, beers = 0;

  for (const store of STORES) {
    process.stdout.write(`  📥 ${store.username}... `);
    try {
      const extracted = store.type === 'sheets' ? await extractFromSheets(page, store.url)
        : store.type === 'sheets_akihabara' ? await extractFromSheetsAkihabara(page, store.url)
        : await extractFromWeb(page, store.url);

      const result = await saveStore(store.username, extracted);
      if (!result.skipped) {
        total++;
        if (result.is_tap_list) { tapLists++; beers += result.beerCount; }
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\n✅ 完了: ${total}店舗処理 / タップリスト${tapLists}件 / ビール${beers}件`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
