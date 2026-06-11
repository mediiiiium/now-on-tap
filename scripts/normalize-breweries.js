const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // 直近7日以内に追加されたビールのbreweryのみ対象（--all フラグで全件）
  const fullScan = process.argv.includes('--all');
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase.from('beers').select('brewery').not('brewery', 'is', null);
  if (!fullScan) query = query.gte('created_at', since);

  const { data } = await query;
  const unique = [...new Set(data.map(b => b.brewery))].sort();
  console.log(fullScan ? '全件モード' : `直近7日モード (${since.slice(0,10)} 以降)`);
  console.log(`ユニークbrewery数: ${unique.length}`);
  if (unique.length === 0) { console.log('対象なし'); return; }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `以下はクラフトビールのbrewery名一覧です（日本語・英語・略称が混在）。
各brewery名について以下を行ってください：

1. **正式英語名に統一**（例: "うちゅうブルーイング" → "UCHU Brewing"）
2. **表記ゆれを同一名に統一**（例: "Minoh Beer" / "Minoh B" / "Minoh.B" → "Minoh Beer"）
3. **確信が持てない場合はoriginalのまま返す**（変に英語化しない）

ルール：
- 日本のブルワリーは公式サイト・Untappdで使われている英語名を優先
- "brewery" の有無など細かい表記は統一する（例: "Brewing" vs "Brewery"）
- コラボ表記（"A x B"）はそのまま維持
- 確信がない場合は canonical を null にする

以下のJSON配列のみ返してください（コードブロック不要）:
[{ "original": "元の名前", "canonical": "正規化後の英語名 or null" }]

brewery一覧:
${unique.map(b => `- ${b}`).join('\n')}`,
    }],
  });

  let results;
  try {
    const text = response.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    results = JSON.parse(text);
  } catch (e) {
    console.error('JSON解析エラー:', response.content[0].text.slice(0, 500));
    throw e;
  }

  // 確認表示
  const toUpdate = results.filter(r => r.canonical && r.canonical !== r.original);
  const toSkip   = results.filter(r => !r.canonical || r.canonical === r.original);
  console.log(`更新予定: ${toUpdate.length}件 / スキップ: ${toSkip.length}件\n`);
  toUpdate.forEach(r => console.log(`  "${r.original}" → "${r.canonical}"`));

  // DB更新（brewery と brewery_en を同時に設定）
  let updated = 0;
  for (const { original, canonical } of toUpdate) {
    const { error, count } = await supabase
      .from('beers')
      .update({ brewery: canonical, brewery_en: canonical }, { count: 'exact' })
      .eq('brewery', original);
    if (error) { console.error('❌', original, error.message); continue; }
    if (count > 0) { process.stdout.write('.'); updated += count; }
  }

  console.log(`\n\n✅ 更新: ${updated}レコード`);

  // 更新後のユニーク数
  const { data: after } = await supabase.from('beers').select('brewery').not('brewery', 'is', null);
  const afterUnique = new Set(after.map(b => b.brewery)).size;
  console.log(`brewery種類: ${unique.length} → ${afterUnique}`);
}

run().catch(console.error);
