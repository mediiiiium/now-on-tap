// bars テーブルの name_en / area_en を一括補完
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: bars } = await supabase
    .from('bars')
    .select('id, instagram_username, name, area, name_en, area_en');

  const targets = bars.filter(b => !b.name_en || !b.area_en);
  console.log(`対象: ${targets.length}件\n`);
  if (targets.length === 0) { console.log('対象なし'); return; }

  const list = targets.map(b =>
    `- id:${b.id}  username:@${b.instagram_username}  name:"${b.name ?? ''}"  area:"${b.area ?? ''}"`
  ).join('\n');

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: `以下は東京近郊のクラフトビアバー一覧です。
各バーについて英語名とエリアの英語表記を返してください。

name_en : バー名の英語表記（例: "Craft Beer Lab Shibuya"）。公式英語名があればそれを優先。不明なら null
area_en : エリア名の英語表記（例: "Shibuya", "Shimokitazawa", "Koenji"）。駅名のローマ字表記で。

ルール：
- 公式サイト・Instagram等で使われている英語名を優先
- 確信がない name_en は null（ハルシネーション禁止）
- area_en はローマ字化できるので積極的に埋める
- JSON配列のみ返してください（コードブロック不要）

[{ "id": 数字, "name_en": "..." or null, "area_en": "..." or null }]

バー一覧:
${list}` }],
  });

  let results;
  try {
    const text = res.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    results = JSON.parse(text);
  } catch (e) {
    console.error('JSON解析エラー:', e.message);
    throw e;
  }

  let updated = 0;
  for (const r of results) {
    const upd = {};
    if (r.name_en) upd.name_en = r.name_en;
    if (r.area_en) upd.area_en = r.area_en;
    if (Object.keys(upd).length === 0) continue;
    const { error } = await supabase.from('bars').update(upd).eq('id', r.id);
    if (error) { process.stdout.write('x'); continue; }
    process.stdout.write('.');
    updated++;
  }

  console.log(`\n✅ 更新: ${updated}件`);
}

run().catch(console.error);
