// beers.style をbeer_stylesマスタに正規化
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // マスタ取得
  const { data: masterRows } = await supabase.from('beer_styles').select('name, group_name');
  const masterNames = new Set(masterRows.map(r => r.name));
  const masterList = masterRows.map(r => `${r.name} (${r.group_name})`).join('\n');

  // 現在のスタイル一覧
  const { data: beers } = await supabase.from('beers').select('id, style').not('style', 'is', null);

  // マスタ未一致のユニークスタイルを抽出
  const styleSet = new Set(beers.map(b => b.style));
  const unmapped = [...styleSet].filter(s => !masterNames.has(s));

  console.log(`総ユニークスタイル: ${styleSet.size}`);
  console.log(`マスタ一致: ${styleSet.size - unmapped.length}`);
  console.log(`未マッピング: ${unmapped.length}件\n`);

  if (unmapped.length === 0) {
    console.log('全スタイルがマスタと一致しています');
    return;
  }

  // Claudeで未マッピングスタイルを正規化
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: `以下の「未マッピングスタイル」を、「マスタスタイル一覧」の中から最も近いものにマッピングしてください。

ルール：
- マスタにある名前をそのまま使う
- 確信が持てない場合は null（新規追加候補としてフラグ）
- JSON配列のみ返してください（コードブロック不要）

[{ "from": "元のスタイル名", "to": "マスタのスタイル名 or null" }]

マスタスタイル一覧:
${masterList}

未マッピングスタイル:
${unmapped.map(s => '- ' + s).join('\n')}` }],
  });

  const text = res.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const mappings = JSON.parse(text);

  // マッピング結果を表示
  const toUpdate = mappings.filter(m => m.to);
  const toReview = mappings.filter(m => !m.to);

  console.log('=== マッピング結果 ===');
  toUpdate.forEach(m => console.log(`  "${m.from}" → "${m.to}"`));
  if (toReview.length > 0) {
    console.log('\n=== 要確認（マスタ新規追加候補） ===');
    toReview.forEach(m => console.log(`  "${m.from}"`));
  }

  // beers.style を更新
  let updated = 0;
  for (const m of toUpdate) {
    const ids = beers.filter(b => b.style === m.from).map(b => b.id);
    const { error } = await supabase.from('beers').update({ style: m.to }).in('id', ids);
    if (error) { console.log('❌', m.from, error.message); continue; }
    process.stdout.write('.');
    updated += ids.length;
  }

  console.log(`\n\n✅ 更新: ${updated}件`);
}

run().catch(console.error);
