/**
 * beers.brewery (text) を breweries マスタに紐付けて brewery_id をセットする
 * 完全一致 → name_ja一致 → Claude Haiku による名寄せ の順で試みる
 */
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DRY_RUN = process.argv.includes('--dry-run');

async function resolveWithClaude(unmatchedNames, breweries) {
  const breweryList = breweries.map(b => `${b.id}\t${b.name}${b.name_ja ? ` / ${b.name_ja}` : ''}`).join('\n');
  const nameList = unmatchedNames.join('\n');

  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `以下のビールに記載されたブルワリー名を、マスタリストの brewery_id に紐付けてください。
省略形・別名・表記揺れを考慮して最もふさわしいものを選んでください。
マッチしない（海外ブルワリーや不明）場合は null にしてください。

## 紐付けたいブルワリー名（1行1件）
${nameList}

## マスタリスト（brewery_id<TAB>name / name_ja）
${breweryList}

## 出力形式（JSONのみ、説明不要）
{"ブルワリー名": brewery_id_or_null, ...}`,
    }],
  });

  const t = msg.content[0].text;
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return {};
  }
}

async function main() {
  const { data: beers } = await sb.from('beers').select('id, brewery, brewery_id').not('brewery', 'is', null);
  const { data: breweries } = await sb.from('breweries').select('id, name, name_ja');

  const byName = new Map(breweries.map(b => [b.name, b.id]));
  const byNameJa = new Map(breweries.filter(b => b.name_ja).map(b => [b.name_ja, b.id]));

  const updates = [];
  const unmatchedNames = new Set();

  for (const beer of beers) {
    if (beer.brewery_id) continue; // すでに紐付け済み
    const id = byName.get(beer.brewery) ?? byNameJa.get(beer.brewery);
    if (id) {
      updates.push({ id: beer.id, brewery_id: id });
    } else {
      unmatchedNames.add(beer.brewery);
    }
  }

  console.log(`完全一致: ${updates.length}件 / 未マッチ: ${unmatchedNames.size}件`);

  // Claude で名寄せ
  if (unmatchedNames.size > 0) {
    console.log('Claude で名寄せ中...');
    const resolved = await resolveWithClaude([...unmatchedNames], breweries);
    for (const beer of beers) {
      if (beer.brewery_id) continue;
      if (byName.has(beer.brewery) || byNameJa.has(beer.brewery)) continue;
      const rid = resolved[beer.brewery];
      if (rid) updates.push({ id: beer.id, brewery_id: rid });
    }
    const nullCount = Object.values(resolved).filter(v => v === null).length;
    console.log(`Claude マッチ: ${Object.values(resolved).filter(v => v !== null).length}件 / null: ${nullCount}件`);
  }

  console.log(`更新対象: ${updates.length}件`);

  if (DRY_RUN) {
    updates.slice(0, 10).forEach(u => console.log(u));
    return;
  }

  // バッチ更新
  let ok = 0;
  for (const u of updates) {
    const { error } = await sb.from('beers').update({ brewery_id: u.brewery_id }).eq('id', u.id);
    if (error) console.error(`✗ beer ${u.id}: ${error.message}`);
    else ok++;
  }
  console.log(`完了: ${ok}/${updates.length} 更新`);
}

main().catch(console.error);
