// area_en から area（日本語）を逆変換で補完
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data } = await supabase
    .from('bars')
    .select('id, area_en')
    .is('area', null)
    .not('area_en', 'is', null);

  console.log(`対象: ${data.length}件`);
  if (data.length === 0) { console.log('対象なし'); return; }

  const list = data.map(b => `- id:${b.id}  area_en:"${b.area_en}"`).join('\n');

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: `以下の英語エリア名を日本語の駅名・地区名に変換してください。
JSON配列のみ返してください（コードブロック不要）。
[{ "id": 数字, "area": "日本語" }]

${list}` }],
  });

  const text = res.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const results = JSON.parse(text);

  let updated = 0;
  for (const r of results) {
    if (!r.area) continue;
    const { error } = await supabase.from('bars').update({ area: r.area }).eq('id', r.id);
    if (error) { console.log('x', r.id); continue; }
    console.log(r.id, '->', r.area);
    updated++;
  }
  console.log(`\n✅ 更新: ${updated}件`);
}

run().catch(console.error);
