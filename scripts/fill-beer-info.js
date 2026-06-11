// brewery=null のビールをClaudeの知識で補完（confidence:highのみ採用）
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BATCH_SIZE = 30;

async function fillBeerInfo() {
  const { data: beers } = await supabase
    .from('beers')
    .select('id, name, style, abv')
    .is('brewery', null)
    .not('name', 'is', null);

  console.log(`対象: ${beers.length}件\n`);

  // 同一nameをまとめてユニーク化（IDは後でまとめて更新）
  const nameMap = {};
  for (const b of beers) {
    if (!nameMap[b.name]) nameMap[b.name] = { ids: [], style: b.style, abv: b.abv };
    nameMap[b.name].ids.push(b.id);
  }
  const unique = Object.entries(nameMap); // [[name, {ids, style, abv}], ...]

  let applied = 0, skipped = 0;

  // バッチ処理
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const list = batch.map(([name, { style, abv }]) =>
      `- name: "${name}"${style ? `  style: ${style}` : ''}${abv ? `  abv: ${abv}` : ''}`
    ).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `以下はクラフトビアバーで提供されているビールの一覧です（主に日本・海外の既存商品）。
各ビールについて、あなたが確実に知っている情報のみを補完してください。

【重要ルール】
- confidence は "high"（確実に知っている）か "low"（推測・不確か）のみ
- 少しでも自信がない場合は confidence: "low" にして brewery/style/abv は null にする
- 季節限定・店舗オリジナル・読み取り不明なビールは low にする
- 既知の商品でもabvが曖昧なら abv は null にする
- "Unknown"・"不明" は絶対に使わない。不明なら null

以下のJSON配列のみ返してください（コードブロック不要）:
[
  {
    "name": "元のビール名（変更しない）",
    "brewery": "確実に判明している醸造所名 or null",
    "style": "確実に判明しているスタイル or null",
    "abv": "確実に判明しているABV（例: 4.2%）or null",
    "confidence": "high or low"
  }
]

ビール一覧:
${list}`,
      }],
    });

    let results;
    try {
      const text = response.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      results = JSON.parse(text);
    } catch (e) {
      console.error('JSON解析エラー (batch', i, '):', e.message);
      continue;
    }

    for (const r of results) {
      if (r.confidence !== 'high') { skipped++; continue; }
      if (!r.brewery && !r.style && !r.abv) { skipped++; continue; }

      const entry = nameMap[r.name];
      if (!entry) continue;

      const update = {};
      if (r.brewery) update.brewery = r.brewery;
      if (r.style && !entry.style) update.style = r.style;   // 既存styleは上書きしない
      if (r.abv && !entry.abv) update.abv = r.abv;           // 既存abvは上書きしない

      if (Object.keys(update).length === 0) { skipped++; continue; }

      const { error } = await supabase.from('beers').update(update).in('id', entry.ids);
      if (error) { console.error('❌', r.name, error.message); continue; }

      console.log(`✅ "${r.name}" → ${JSON.stringify(update)} (${entry.ids.length}件)`);
      applied++;
    }

    process.stdout.write(`  [${Math.min(i + BATCH_SIZE, unique.length)}/${unique.length}]\n`);
  }

  console.log(`\n完了 — 補完: ${applied}件 / スキップ: ${skipped}件`);
}

fillBeerInfo().catch(console.error);
