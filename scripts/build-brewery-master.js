/**
 * beers.brewery の表記揺れを名寄せして breweries マスターを構築する
 * 実行前に add_breweries_master.sql をSupabaseで実行しておくこと
 *
 * Usage: node scripts/build-brewery-master.js [--dry-run]
 */
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DRY_RUN = process.argv.includes('--dry-run');

async function getBreweriesFromBeers() {
  const { data, error } = await supabase
    .from('beers')
    .select('brewery')
    .not('brewery', 'is', null);
  if (error) throw error;
  return [...new Set(data.map(r => r.brewery))].sort();
}

async function clusterBreweries(aliases) {
  const prompt = `以下はクラフトビールのブルワリー名リストです（OCRや手入力で表記揺れあり）。
同一ブルワリーをまとめてグループ化し、各グループの正式英語名・日本語名・都道府県・国を推定してください。

ルール:
- 英語名と日本語名が両方ある場合は両方出力
- 日本のブルワリーは prefecture に都道府県名（例: 東京都, 大阪府）
- 海外は country に国名（英語: Belgium, UK, USA等）、prefectureはnull
- コラボ表記（A x B）は代表的なブルワリー名で登録（xより前の最初のブルワリー）
- 不明な場合はnull

出力形式（JSON配列）:
[
  {
    "name": "正式英語名",
    "name_ja": "日本語名またはnull",
    "prefecture": "都道府県またはnull",
    "country": "Japan or 国名",
    "aliases": ["この名前にマップすべき表記リスト"]
  }
]

ブルワリー名リスト:
${aliases.join('\n')}`;

  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('JSON not found in response:\n' + text);
  return JSON.parse(match[0]);
}

async function insertBrewery(brewery) {
  const { data, error } = await supabase
    .from('breweries')
    .upsert({
      name: brewery.name,
      name_ja: brewery.name_ja ?? null,
      prefecture: brewery.prefecture ?? null,
      country: brewery.country ?? 'Japan',
    }, { onConflict: 'name' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function insertAliases(breweryId, aliases) {
  const rows = aliases.map(alias => ({ brewery_id: breweryId, alias }));
  const { error } = await supabase
    .from('brewery_aliases')
    .upsert(rows, { onConflict: 'alias', ignoreDuplicates: true });
  if (error) {
    console.warn(`  alias insert warning:`, error.message);
  }
}

async function main() {
  console.log('📋 Fetching brewery names from beers table...');
  const aliases = await getBreweriesFromBeers();
  console.log(`  ${aliases.length} unique brewery strings found`);

  console.log('🤖 Clustering with Claude Haiku...');
  const clusters = await clusterBreweries(aliases);
  console.log(`  ${clusters.length} brewery groups identified`);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN ---');
    for (const b of clusters) {
      console.log(`\n${b.name} (${b.country}${b.prefecture ? ' / ' + b.prefecture : ''})`);
      if (b.name_ja) console.log(`  ja: ${b.name_ja}`);
      console.log(`  aliases: ${b.aliases.join(', ')}`);
    }
    return;
  }

  console.log('\n💾 Inserting into breweries table...');
  let ok = 0, fail = 0;
  for (const brewery of clusters) {
    try {
      const id = await insertBrewery(brewery);
      await insertAliases(id, brewery.aliases ?? []);
      console.log(`  ✓ ${brewery.name}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${brewery.name}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} inserted, ${fail} failed`);
}

main().catch(console.error);
