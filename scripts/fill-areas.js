// area未設定のbarsをClaudeで一括補完するスクリプト
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fillAreas() {
  // area未設定の店舗を取得
  const { data: bars, error } = await supabase
    .from('bars')
    .select('instagram_username, name, area')
    .is('area', null)
    .order('instagram_username');

  if (error) throw error;
  console.log(`area未設定: ${bars.length}件\n`);

  // Claudeに一括で聞く
  const barList = bars.map(b =>
    `- instagram: @${b.instagram_username}  name: ${b.name ?? '(不明)'}`
  ).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `以下は東京近郊のクラフトビアバー・パブのInstagramアカウント一覧です。
各店舗の最寄り駅エリア（例: 渋谷、新宿、中野、三鷹、国立）を調べて回答してください。

判断のヒント：
- アカウント名に地名が含まれる場合はそれを優先（例: citraba_nakano → 中野）
- 不明・確信が持てない場合は null にしてください

以下のJSON形式のみ返してください（コードブロック不要）:
[
  { "instagram_username": "アカウント名", "area": "エリア名 or null" }
]

店舗一覧:
${barList}`,
    }],
  });

  let results;
  try {
    const text = response.content[0].text.trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, '');
    results = JSON.parse(text);
  } catch (e) {
    console.error('JSON解析エラー:', response.content[0].text);
    throw e;
  }

  // 結果を表示・更新
  let updated = 0;
  let skipped = 0;

  for (const r of results) {
    if (!r.area) {
      console.log(`⬜ @${r.instagram_username} → 不明のためスキップ`);
      skipped++;
      continue;
    }

    const { error: ue } = await supabase
      .from('bars')
      .update({ area: r.area })
      .eq('instagram_username', r.instagram_username);

    if (ue) {
      console.error(`❌ @${r.instagram_username}: ${ue.message}`);
    } else {
      console.log(`✅ @${r.instagram_username} → ${r.area}`);
      updated++;
    }
  }

  console.log(`\n完了: 更新 ${updated}件 / スキップ ${skipped}件`);
}

fillAreas().catch(console.error);
