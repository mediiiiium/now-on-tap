// name_en から日本語バー名（name）をClaudeで補完
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BATCH_SIZE = 50;

async function inferJaNames(bars) {
  const list = bars.map(b =>
    `- id:${b.id}  username:@${b.instagram_username}  name_en:"${b.name_en}"`
  ).join('\n');

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: `以下は東京近郊のクラフトビアバー・ブルワリー一覧です。
name_en（英語名）と instagram_username をもとに、日本語の店舗名（name）を返してください。

ルール：
- 日本語名が公式に存在する場合のみ日本語で返す（例: "Craft Beer Market 三越前"、"ビアコボ中野"）
- 英語名がそのまま公式名の場合は英語のまま返す（例: "KARAFA"、"Mikkeller Tokyo"）
- カタカナ表記が自然な場合はカタカナでよい（例: "イブリュー 銀座"）
- 推測が難しい場合は name_en をそのまま name に使う
- JSON配列のみ返してください（コードブロック不要）

[{ "id": 数字, "name": "..." }]

バー一覧:
${list}` }],
  });

  const text = res.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(text);
}

async function run() {
  const { data: bars } = await supabase
    .from('bars')
    .select('id, instagram_username, name, name_en')
    .is('name', null)
    .not('name_en', 'is', null);

  console.log(`対象: ${bars.length}件\n`);
  if (bars.length === 0) { console.log('対象なし'); return; }

  let updated = 0;

  for (let i = 0; i < bars.length; i += BATCH_SIZE) {
    const batch = bars.slice(i, i + BATCH_SIZE);
    console.log(`バッチ ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(bars.length / BATCH_SIZE)} (${batch.length}件)...`);

    let results;
    try {
      results = await inferJaNames(batch);
    } catch (e) {
      console.error('JSON解析エラー:', e.message);
      continue;
    }

    for (const r of results) {
      if (!r.name) continue;
      const { error } = await supabase.from('bars').update({ name: r.name }).eq('id', r.id);
      if (error) { process.stdout.write('x'); continue; }
      process.stdout.write('.');
      updated++;
    }
    console.log();
  }

  console.log(`\n✅ 更新: ${updated}件`);
}

run().catch(console.error);
