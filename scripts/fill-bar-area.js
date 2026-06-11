// area / area_en が未設定のバーを Claude で補完
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: bars } = await supabase
    .from('bars')
    .select('id, instagram_username, name, name_en, area, area_en')
    .or('area.is.null,area_en.is.null');

  console.log(`対象: ${bars.length}件\n`);
  if (bars.length === 0) { console.log('対象なし'); return; }

  const list = bars.map(b =>
    `- id:${b.id}  username:@${b.instagram_username}  name:"${b.name ?? ''}"  name_en:"${b.name_en ?? ''}"`
  ).join('\n');

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: `以下は東京近郊のクラフトビアバー・ブルワリー一覧です。
店舗名・Instagramユーザー名から所在エリア（最寄り駅・地区名）を推測してください。

area    : 日本語エリア名（例: "渋谷", "下北沢", "三鷹"）
area_en : 英語エリア名（例: "Shibuya", "Shimokitazawa", "Mitaka"）

ルール：
- 東京近郊の実在する駅名・地区名を使う
- username や店名に地名が含まれていればそれを使う（例: taki_shibuya → 渋谷）
- 推測が難しい場合は null
- 醸造所（brewery）は実際の所在地が不明なことが多いので無理に埋めなくてよい
- JSON配列のみ返してください（コードブロック不要）

[{ "id": 数字, "area": "..." or null, "area_en": "..." or null }]

バー一覧:
${list}` }],
  });

  const text = res.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  let results;
  try {
    results = JSON.parse(text);
  } catch (e) {
    console.error('JSON解析エラー:', e.message);
    throw e;
  }

  let updated = 0;
  for (const r of results) {
    const bar = bars.find(b => b.id === r.id);
    const upd = {};
    if (!bar.area    && r.area)    upd.area    = r.area;
    if (!bar.area_en && r.area_en) upd.area_en = r.area_en;
    if (Object.keys(upd).length === 0) continue;
    const { error } = await supabase.from('bars').update(upd).eq('id', r.id);
    if (error) { process.stdout.write('x'); continue; }
    process.stdout.write('.');
    updated++;
  }

  console.log(`\n✅ 更新: ${updated}件`);
}

run().catch(console.error);
