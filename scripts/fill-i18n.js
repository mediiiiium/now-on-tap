// 既存beersの name_ja/name_en/brewery_en を一括補完
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BATCH = 40;

async function translate(items) {
  const list = items.map(b =>
    `- id:${b.id}  name:"${b.name}"  brewery:"${b.brewery ?? ''}"`
  ).join('\n');

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: `以下はクラフトビールのname・brewery一覧です。
各エントリについて以下を返してください：

name_ja  : 日本語ビール名（元が日本語ならそのまま、英語なら null）
name_en  : 英語ビール名（元が英語ならそのまま、日本語なら英訳 or ローマ字）
brewery_en: 英語ブルワリー名（元が英語ならそのまま、日本語なら英訳）

ルール：
- 固有名詞はローマ字より公式英語名を優先（例: "志賀高原ビール" → "Shiga Kogen Beer"）
- 翻訳に自信がない場合は null（ハルシネーション禁止）
- brewery が空/"" の場合 brewery_en も null
- name_en は必ず返す（英語ビール名が不明でもローマ字でOK）

JSON配列のみ返してください（コードブロック不要）:
[{ "id": 数字, "name_ja": "..." or null, "name_en": "...", "brewery_en": "..." or null }]

一覧:
${list}` }],
  });

  const text = res.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(text);
}

async function run() {
  const fullScan = process.argv.includes('--all');
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase.from('beers').select('id, name, brewery').is('name_en', null);
  if (!fullScan) query = query.gte('created_at', since);

  const { data: beers } = await query;
  console.log(fullScan ? '全件モード' : `直近7日モード (${since.slice(0,10)} 以降)`);
  console.log(`対象: ${beers.length}件\n`);
  if (beers.length === 0) { console.log('対象なし'); return; }

  let updated = 0;
  for (let i = 0; i < beers.length; i += BATCH) {
    const batch = beers.slice(i, i + BATCH);
    process.stdout.write(`[${i+1}-${Math.min(i+BATCH, beers.length)}/${beers.length}] `);

    let results;
    try {
      results = await translate(batch);
    } catch (e) {
      console.log('❌ 解析エラー:', e.message);
      continue;
    }

    for (const r of results) {
      const upd = {};
      if (r.name_ja  !== undefined) upd.name_ja    = r.name_ja;
      if (r.name_en  !== undefined) upd.name_en    = r.name_en;
      if (r.brewery_en !== undefined) upd.brewery_en = r.brewery_en;
      if (Object.keys(upd).length === 0) continue;
      const { error } = await supabase.from('beers').update(upd).eq('id', r.id);
      if (error) { process.stdout.write('x'); continue; }
      process.stdout.write('.');
      updated++;
    }
    console.log();
  }

  console.log(`\n✅ 更新: ${updated}件`);

  // サンプル確認
  const { data: sample } = await supabase
    .from('beers')
    .select('name, name_ja, name_en, brewery, brewery_en')
    .not('name_en', 'is', null)
    .limit(15);
  console.log('\nサンプル:');
  sample.forEach(b => console.log(JSON.stringify(b)));
}

run().catch(console.error);
