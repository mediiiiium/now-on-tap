const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // 新スタイル追加（まだDBにないもの）
  const newStyles = [
    { name: 'Cold IPA',  category: 'Hoppy',  display_order: 6 },
    { name: 'Black IPA', category: 'Dark',   display_order: 23 },
    { name: 'Kölsch',    category: 'Lager',  display_order: 13 },
    { name: 'Barrel Aged', category: 'Other', display_order: 84 },
  ];
  for (const s of newStyles) {
    const { error } = await supabase.from('styles').upsert(s, { onConflict: 'name' });
    if (error) console.error(`❌ style ${s.name}:`, error.message);
    else console.log(`✅ style: ${s.name}`);
  }

  // スタイルID取得
  const { data: styles } = await supabase.from('styles').select('id, name');
  const sid = Object.fromEntries(styles.map(s => [s.name, s.id]));

  // Visionの生出力 → マスタスタイル エイリアス一覧
  // null に設定するもの（ビール名・汎用すぎる語）はここに含めない
  const aliases = [
    // IPA
    { style_id: sid['IPA'], alias: 'American IPA' },
    { style_id: sid['IPA'], alias: 'APA' },
    { style_id: sid['IPA'], alias: 'Frozen Fresh Hop IPA' },
    { style_id: sid['IPA'], alias: 'Spice IPA' },
    { style_id: sid['IPA'], alias: 'Murky IPA' },
    { style_id: sid['IPA'], alias: 'Japanese Pale Ale' },
    // Hazy IPA
    { style_id: sid['Hazy IPA'], alias: 'Hazy Pale Ale' },
    { style_id: sid['Hazy IPA'], alias: 'HAZY PALE ALE' },
    { style_id: sid['Hazy IPA'], alias: 'Hazy' },
    { style_id: sid['Hazy IPA'], alias: 'Juicy IPA' },
    { style_id: sid['Hazy IPA'], alias: 'Full Power Hazy IPA' },
    // West Coast IPA
    { style_id: sid['West Coast IPA'], alias: 'TDH WCIPA' },
    // DIPA (= Imperial IPA)
    { style_id: sid['DIPA'], alias: 'Imperial IPA' },
    { style_id: sid['DIPA'], alias: 'Hazy Double IPA' },
    { style_id: sid['DIPA'], alias: 'DDH Imperial Hazy IPA' },
    { style_id: sid['DIPA'], alias: 'Imperial Hazy IPA' },
    { style_id: sid['DIPA'], alias: 'Imperial Hazy DIPA' },
    { style_id: sid['DIPA'], alias: 'W-IPA' },
    { style_id: sid['DIPA'], alias: 'American DIPA' },
    { style_id: sid['DIPA'], alias: 'West Coast DIPA' },
    { style_id: sid['DIPA'], alias: 'West Coast Double IPA' },
    { style_id: sid['DIPA'], alias: 'Triple IPA' },
    // Session IPA
    { style_id: sid['Session IPA'], alias: 'Cold Session IPA' },
    // Pale Ale
    { style_id: sid['Pale Ale'], alias: 'Ale' },
    { style_id: sid['Pale Ale'], alias: 'ALE' },
    { style_id: sid['Pale Ale'], alias: 'エール' },
    { style_id: sid['Pale Ale'], alias: 'English Pale Ale' },
    { style_id: sid['Pale Ale'], alias: 'English Style Ale' },
    { style_id: sid['Pale Ale'], alias: 'English Bitter' },
    { style_id: sid['Pale Ale'], alias: 'Best Bitter' },
    { style_id: sid['Pale Ale'], alias: 'PALE ALE' },
    { style_id: sid['Pale Ale'], alias: 'Belgian Pale Ale' },
    { style_id: sid['Pale Ale'], alias: 'ゴールドエール' },
    { style_id: sid['Pale Ale'], alias: 'Special Ale' },
    { style_id: sid['Pale Ale'], alias: 'Light Ale' },
    { style_id: sid['Pale Ale'], alias: 'Cream Ale' },
    // Cold IPA
    { style_id: sid['Cold IPA'], alias: 'cold ipa' },
    // Black IPA
    { style_id: sid['Black IPA'], alias: 'BLACK IPA' },
    { style_id: sid['Black IPA'], alias: 'Black Ale' },
    { style_id: sid['Black IPA'], alias: 'BLACK ALE' },
    { style_id: sid['Black IPA'], alias: 'Black/Stout' },
    { style_id: sid['Black IPA'], alias: 'Black' },
    { style_id: sid['Black IPA'], alias: 'Darkness' },
    // Kölsch
    { style_id: sid['Kölsch'], alias: 'Kolsch' },
    { style_id: sid['Kölsch'], alias: 'Hoppy Kölsch' },
    // Pilsner
    { style_id: sid['Pilsner'], alias: 'German Pilsner' },
    { style_id: sid['Pilsner'], alias: 'Italian Pilsner' },
    { style_id: sid['Pilsner'], alias: 'ITALIAN-STYLE PILS' },
    { style_id: sid['Pilsner'], alias: 'ITALIAN-STYLE PILSIL' },
    { style_id: sid['Pilsner'], alias: 'Neon Pilsner' },
    { style_id: sid['Pilsner'], alias: 'Czech Pilsner' },
    { style_id: sid['Pilsner'], alias: 'West Coast Pilsner' },
    { style_id: sid['Pilsner'], alias: 'PILSNER' },
    { style_id: sid['Pilsner'], alias: 'Pilsener' },
    { style_id: sid['Pilsner'], alias: 'ビルスナー' },
    // Lager
    { style_id: sid['Lager'], alias: 'LAGER' },
    { style_id: sid['Lager'], alias: 'Premium Lager' },
    { style_id: sid['Lager'], alias: 'Mexican Lager' },
    { style_id: sid['Lager'], alias: 'Dark Lager' },
    { style_id: sid['Lager'], alias: 'Dry Lager' },
    { style_id: sid['Lager'], alias: 'Hazy Lager' },
    { style_id: sid['Lager'], alias: 'Rice Lager' },
    { style_id: sid['Lager'], alias: 'Heartland' },
    { style_id: sid['Lager'], alias: 'ハートランド' },
    // Helles
    { style_id: sid['Helles'], alias: 'ヘルス' },
    // Stout
    { style_id: sid['Stout'], alias: 'Irish Dry Stout' },
    { style_id: sid['Stout'], alias: 'NITRO Milk Stout' },
    { style_id: sid['Stout'], alias: "Jazz (Irish Dry Stout)" },
    { style_id: sid['Stout'], alias: 'ギネス（黒）' },
    // Imperial Stout
    { style_id: sid['Imperial Stout'], alias: 'British Imperial Stout' },
    // Porter
    { style_id: sid['Porter'], alias: 'Honey Porter' },
    { style_id: sid['Porter'], alias: 'HONEY PORTER' },
    { style_id: sid['Porter'], alias: 'Baltic Porter' },
    // Saison
    { style_id: sid['Saison'], alias: 'Farmhouse' },
    { style_id: sid['Saison'], alias: 'Hoppy Saison' },
    { style_id: sid['Saison'], alias: 'Saison w/ Yuzu & Sorachi Ace' },
    { style_id: sid['Saison'], alias: 'Saison Gruit IPA' },
    // Belgian Ale
    { style_id: sid['Belgian Ale'], alias: 'Belgian Blonde' },
    { style_id: sid['Belgian Ale'], alias: 'Strong Golden Ale' },
    { style_id: sid['Belgian Ale'], alias: 'Tripel' },
    { style_id: sid['Belgian Ale'], alias: 'ベルジャン（Belgique）' },
    { style_id: sid['Belgian Ale'], alias: 'American-Belgo Style Ale' },
    { style_id: sid['Belgian Ale'], alias: 'American Belgian Ale' },
    // Witbier
    { style_id: sid['Witbier'], alias: 'Belgian White' },
    { style_id: sid['Witbier'], alias: 'Belgian Wit w/ Cherry' },
    { style_id: sid['Witbier'], alias: 'White Ale' },
    // Lambic
    { style_id: sid['Lambic'], alias: 'Lambiek' },
    // Sour
    { style_id: sid['Sour'], alias: 'Sour IPA' },
    { style_id: sid['Sour'], alias: 'Sour Ale' },
    { style_id: sid['Sour'], alias: 'Wild Ale with Fruits' },
    { style_id: sid['Sour'], alias: 'Smoothie Sour Ale' },
    { style_id: sid['Sour'], alias: 'One Head Sour' },
    { style_id: sid['Sour'], alias: 'Fruit Sour IPA' },
    // Wheat Beer
    { style_id: sid['Wheat'], alias: 'Weiss' },
    { style_id: sid['Wheat'], alias: 'ブラックヴァイツェン' },
    { style_id: sid['Wheat'], alias: 'ヴァイヘン' },
    // Amber Ale
    { style_id: sid['Amber Ale'], alias: 'Rouge/Red' },
    // Red Ale
    { style_id: sid['Red Ale'], alias: 'Red IPA' },
    // Fruit Beer
    { style_id: sid['Fruit Beer'], alias: 'Fruit Ale' },
    { style_id: sid['Fruit Beer'], alias: 'フルーツビール' },
    // Barrel Aged
    { style_id: sid['Barrel Aged'], alias: 'Hopped Cyser' },
    // Cider
    { style_id: sid['Cider'], alias: 'English Cider' },
  ];

  let ok = 0, skip = 0;
  for (const a of aliases) {
    if (!a.style_id) { console.warn(`⚠️  style_id not found for alias: ${a.alias}`); skip++; continue; }
    const { error } = await supabase.from('style_aliases').upsert(a, { onConflict: 'alias', ignoreDuplicates: true });
    if (error) { console.error(`❌ ${a.alias}: ${error.message}`); skip++; }
    else ok++;
  }
  console.log(`\n✅ エイリアス: ${ok}件追加, ${skip}件スキップ`);
}

run().catch(console.error);
