// style が未設定のビールを Claude で補完
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BATCH_SIZE = 40;

async function inferStyles(beers) {
  const list = beers.map(b =>
    `- id:${b.id}  name:"${b.name}"  brewery:"${b.brewery ?? ''}"`
  ).join('\n');

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: `以下のクラフトビールについて、ビアスタイルを英語で返してください。

ルール：
- 標準的なスタイル名を英語で（例: "IPA", "Stout", "Witbier", "Saison", "Pale Ale", "Lager"）
- ビール名・ブルワリー名から判断できる場合のみ設定
- 判断できない場合は null
- JSON配列のみ返してください（コードブロック不要）

[{ "id": 数字, "style": "..." or null }]

ビール一覧:
${list}` }],
  });

  const text = res.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(text);
}

async function run() {
  const { data: beers } = await supabase
    .from('beers')
    .select('id, name, brewery, style')
    .is('style', null)
    .not('name', 'is', null);

  console.log(`対象: ${beers.length}件\n`);
  if (beers.length === 0) { console.log('対象なし'); return; }

  let updated = 0;

  for (let i = 0; i < beers.length; i += BATCH_SIZE) {
    const batch = beers.slice(i, i + BATCH_SIZE);
    console.log(`バッチ ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(beers.length / BATCH_SIZE)} (${batch.length}件)...`);

    let results;
    try {
      results = await inferStyles(batch);
    } catch (e) {
      console.error('JSON解析エラー:', e.message);
      continue;
    }

    for (const r of results) {
      if (!r.style) continue;
      const { error } = await supabase.from('beers').update({ style: r.style }).eq('id', r.id);
      if (error) { process.stdout.write('x'); continue; }
      process.stdout.write('.');
      updated++;
    }
    console.log();
  }

  console.log(`\n✅ 更新: ${updated}件`);
}

run().catch(console.error);
