/**
 * brewery_known_beers を参照して beers テーブルを補完する
 * - beers.abv が NULL → known_beers.abv で補完
 * - beers.name の表記揺れ → Claude で正式名に補正（brewery_id が一致する場合のみ）
 *
 * Usage: node scripts/fill-from-known-beers.js [--dry-run] [--skip-names]
 */
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_NAMES = process.argv.includes('--skip-names');

function parseJson(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s === -1 || e === -1) return {};
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return {}; }
}

// Claude でビール名の表記揺れを正式名に補正
async function resolveNamesWithClaude(beerNames, knownNames) {
  if (beerNames.length === 0 || knownNames.length === 0) return {};
  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `ビール名の表記揺れを正式名に補正してください。

ルール（厳守）：
- 言語は変えない（日本語→英語、英語→日本語への変換禁止）
- 情報を削らない（フレーバー・バージョン・サブタイトルを消さない）
- 大文字小文字・スペース・記号の揺れのみ補正する
- 確信が持てない場合・一致するものがない場合はnullにする

## 補正したい名前
${beerNames.join('\n')}

## 正式名リスト
${knownNames.join('\n')}

## 出力（JSONのみ）
{"補正したい名前": "正式名 or null", ...}`,
    }],
  });
  return parseJson(msg.content[0].text);
}

async function main() {
  // brewery_id が紐づいているビールを取得
  const { data: beers } = await sb.from('beers')
    .select('id, name, abv, brewery_id')
    .not('brewery_id', 'is', null);

  // brewery_known_beers を全件取得
  const { data: knownBeers } = await sb.from('brewery_known_beers')
    .select('brewery_id, name, abv');

  if (!beers || !knownBeers) { console.error('データ取得失敗'); return; }

  // brewery_id ごとに known_beers をインデックス化
  const knownByBrewery = new Map();
  for (const kb of knownBeers) {
    if (!knownByBrewery.has(kb.brewery_id)) knownByBrewery.set(kb.brewery_id, []);
    knownByBrewery.get(kb.brewery_id).push(kb);
  }

  console.log(`beers: ${beers.length}件 / known_beers: ${knownBeers.length}件`);

  // ── 1. ABV 補完 ──────────────────────────────────────────
  console.log('\n📊 ABV補完...');
  let abvUpdated = 0;

  const beersWithoutAbv = beers.filter(b => !b.abv && b.brewery_id);
  for (const beer of beersWithoutAbv) {
    const knowns = knownByBrewery.get(beer.brewery_id) ?? [];
    // 同名ビールの ABV を探す（大文字小文字無視）
    const match = knowns.find(k => k.name.toLowerCase() === beer.name.toLowerCase() && k.abv);
    if (!match) continue;

    if (DRY_RUN) {
      console.log(`  [DRY] beer ${beer.id} "${beer.name}": abv → ${match.abv}`);
    } else {
      const { error } = await sb.from('beers').update({ abv: match.abv }).eq('id', beer.id);
      if (error) console.error(`  ✗ beer ${beer.id}: ${error.message}`);
      else abvUpdated++;
    }
  }
  console.log(`  ABV補完: ${abvUpdated}件`);

  if (SKIP_NAMES) return;

  // ── 2. ビール名補正（brewery ごとに Claude に問い合わせ）──
  console.log('\n📝 ビール名補正...');
  let nameUpdated = 0;

  const breweryIds = [...new Set(beers.filter(b => knownByBrewery.has(b.brewery_id)).map(b => b.brewery_id))];

  for (const breweryId of breweryIds) {
    const knowns = knownByBrewery.get(breweryId);
    const knownNames = knowns.map(k => k.name);
    const knownNameSet = new Set(knownNames.map(n => n.toLowerCase()));

    // 正式名リストに完全一致しないビール名を補正対象にする
    const targets = beers.filter(b =>
      b.brewery_id === breweryId &&
      !knownNameSet.has(b.name.toLowerCase())
    );
    if (targets.length === 0) continue;

    const resolved = await resolveNamesWithClaude(targets.map(b => b.name), knownNames);

    for (const beer of targets) {
      const corrected = resolved[beer.name];
      if (!corrected || corrected === beer.name) continue;

      // 日本語が消えた・短くなった補正は却下
      const hasJa = /[぀-ゟ゠-ヿ一-鿿]/.test(beer.name);
      const correctedHasJa = /[぀-ゟ゠-ヿ一-鿿]/.test(corrected);
      if (hasJa && !correctedHasJa) continue;
      if (corrected.length < beer.name.length * 0.8) continue;

      if (DRY_RUN) {
        console.log(`  [DRY] beer ${beer.id} "${beer.name}" → "${corrected}"`);
      } else {
        const { error } = await sb.from('beers').update({ name: corrected }).eq('id', beer.id);
        if (error) console.error(`  ✗ beer ${beer.id}: ${error.message}`);
        else { console.log(`  ✓ "${beer.name}" → "${corrected}"`); nameUpdated++; }
      }
    }
  }
  console.log(`  名前補正: ${nameUpdated}件`);
}

main().catch(console.error);
