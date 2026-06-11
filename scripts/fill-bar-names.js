// instagram_username から店舗名（name / name_en）を推測して補完
// ①の Instagram プロフィールスクレイピングで上書きされることを前提とした暫定補完
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BATCH_SIZE = 50;

async function inferNames(bars) {
  const list = bars.map(b =>
    `- id:${b.id}  username:@${b.instagram_username}  area:"${b.area ?? ''}"`
  ).join('\n');

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: `以下は東京近郊のクラフトビアバー・ブルワリーのInstagramアカウント一覧です。
instagram_username から店舗名を推測してください。

name    : 店舗名（日本語があれば日本語、英語のみの店なら英語）
name_en : 店舗名の英語表記

ルール：
- username から自然に読み取れる名前のみ返す（例: mikkellertokyo → "Mikkeller Tokyo"）
- 日本語名が推測できる場合は name に日本語を入れる（例: craftbeer_granzoo → name:"グランズー" name_en:"Gran Zoo"）
- 確信が低い場合でも username を英語表記したものを name_en に入れる（最低限の情報として）
- name は確信がなければ null でよい
- JSON配列のみ返してください（コードブロック不要）

[{ "id": 数字, "name": "..." or null, "name_en": "..." or null }]

アカウント一覧:
${list}` }],
  });

  const text = res.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(text);
}

async function run() {
  const { data: bars } = await supabase
    .from('bars')
    .select('id, instagram_username, name, name_en, area')
    .is('name', null);

  console.log(`name未設定: ${bars.length}件\n`);
  if (bars.length === 0) { console.log('対象なし'); return; }

  let updated = 0;

  for (let i = 0; i < bars.length; i += BATCH_SIZE) {
    const batch = bars.slice(i, i + BATCH_SIZE);
    console.log(`バッチ ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(bars.length / BATCH_SIZE)} (${batch.length}件)...`);

    let results;
    try {
      results = await inferNames(batch);
    } catch (e) {
      console.error('JSON解析エラー:', e.message);
      continue;
    }

    for (const r of results) {
      const upd = {};
      if (r.name)    upd.name    = r.name;
      if (r.name_en) upd.name_en = r.name_en;
      if (Object.keys(upd).length === 0) continue;
      const { error } = await supabase.from('bars').update(upd).eq('id', r.id);
      if (error) { process.stdout.write('x'); continue; }
      process.stdout.write('.');
      updated++;
    }
    console.log();
  }

  console.log(`\n✅ 更新: ${updated}件`);
}

run().catch(console.error);
