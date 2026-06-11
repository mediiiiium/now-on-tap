// ビール名・ブルワリー名のクリーンアップ
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  let deleted = 0, updated = 0;

  // ── 1. ゴミデータ削除 ───────────────────────────────────
  // name=null
  const { error: e1, count: c1 } = await supabase.from('beers').delete({ count: 'exact' }).is('name', null);
  if (!e1) { deleted += c1; console.log(`🗑  name=null: ${c1}件削除`); }

  // name=Unknown/不明/空
  const { error: e2, count: c2 } = await supabase.from('beers').delete({ count: 'exact' }).in('name', ['Unknown', '不明', '']);
  if (!e2) { deleted += c2; console.log(`🗑  name=Unknown/不明/空: ${c2}件削除`); }

  // コース/飲み放題系（ビールではなくプランが入り込んでいる）
  const { error: e3, count: c3 } = await supabase.from('beers').delete({ count: 'exact' }).ilike('name', '%コース%');
  if (!e3) { deleted += c3; console.log(`🗑  name=%コース%: ${c3}件削除`); }

  // ── 2. brewery / style の "Unknown"/"不明"/"" → null ──────
  const nullFields = [
    { col: 'brewery', vals: ['Unknown', '不明', '', '醸造所名不明'] },
    { col: 'style',   vals: ['Unknown', '不明', ''] },
  ];
  for (const { col, vals } of nullFields) {
    const { error, count } = await supabase.from('beers').update({ [col]: null }, { count: 'exact' }).in(col, vals);
    if (!error) { updated += count; console.log(`✏️  ${col}=Unknown系 → null: ${count}件`); }
  }

  // ── 3. brewery表記ゆれの正規化 ─────────────────────────
  const breweryMap = [
    // 表記ゆれ → 正規形
    { from: ['JOKUN BREWING LAB', 'JOKUIN BREWING LAB', 'Jokun Brewing Lab'], to: 'Jokun Brewing Lab' },
    { from: ['OUR BREWING'],                                                   to: 'Our Brewing' },
    { from: ['AGARIHAMA BREWERY'],                                             to: 'Agarihama Brewery' },
    { from: ['Sierra Nevada'],                                                  to: 'SIERRA NEVADA' },
    { from: ['Guinness'],                                                       to: 'GUINNESS' },
    { from: ['KIRIN'],                                                          to: 'キリン' },
    { from: ['WCB'],                                                            to: 'West Coast Brewing' },
    { from: ['TY.HARBOR'],                                                      to: 'TY Harbor Brewing' },
    { from: ['Totopia'],                                                        to: 'Topopia' },
    { from: ['横浜ビール'],                                                     to: 'YOKOHAMA BEER' },
    { from: ['BLACK TIDE BREWING'],                                             to: 'BLACKTIDE BREWING' },
  ];
  for (const { from, to } of breweryMap) {
    const { error, count } = await supabase.from('beers').update({ brewery: to }, { count: 'exact' }).in('brewery', from);
    if (!error && count > 0) { updated += count; console.log(`✏️  brewery "${from.join('/')} → ${to}": ${count}件`); }
  }

  // ── 4. nameの番号プレフィックス除去（例: "1.Hopfield" → "Hopfield"）──
  const { data: allBeers } = await supabase.from('beers').select('id, name').not('name', 'is', null);
  const numbered = allBeers.filter(b => /^\d+\.\s*/.test(b.name));
  console.log(`\n✏️  番号プレフィックスあり: ${numbered.length}件`);
  for (const b of numbered) {
    const cleaned = b.name.replace(/^\d+\.\s*/, '');
    const { error } = await supabase.from('beers').update({ name: cleaned }).eq('id', b.id);
    if (!error) { updated++; console.log(`   "${b.name}" → "${cleaned}"`); }
  }

  // ── 5. nameにブルワリー名が重複混入しているもの（手動リスト） ──
  const nameCleans = [
    { old: 'Y.MARKET BREWING ビステリック IPA',   name: 'ビステリック IPA',   brewery: 'Y.MARKET BREWING' },
    { old: 'サンクトガーレン パイナップルエール',  name: 'パイナップルエール', brewery: 'サンクトガーレン' },
    { old: '伊豆の国ビール アルティメットビルス',  name: 'アルティメットビルス', brewery: '伊豆の国ビール' },
    { old: '山ビール ヴァイツェン',               name: 'ヴァイツェン',        brewery: '山ビール' },
    { old: '京都ビール W-IPA',                   name: 'W-IPA',              brewery: '京都ビール' },
    { old: 'Unknown beers from ISHINOMAKI HOP WORKS', name: null,             brewery: null }, // 削除扱い
  ];
  for (const { old, name, brewery } of nameCleans) {
    if (name === null) {
      const { count } = await supabase.from('beers').delete({ count: 'exact' }).eq('name', old);
      if (count > 0) { deleted += count; console.log(`🗑  "${old}" 削除`); }
    } else {
      const { count } = await supabase.from('beers').update({ name, brewery }, { count: 'exact' }).eq('name', old);
      if (count > 0) { updated += count; console.log(`✏️  "${old}" → name="${name}", brewery="${brewery}"`); }
    }
  }

  console.log(`\n✅ 完了 — 削除: ${deleted}件 / 更新: ${updated}件`);

  // 最終件数
  const { count: total } = await supabase.from('beers').select('*', { count: 'exact', head: true });
  console.log(`📊 beers テーブル残り: ${total}件`);
}

run().catch(console.error);
