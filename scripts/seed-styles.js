const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const NEW_STYLES = [
  { name: 'Cold IPA',  category: 'Hoppy',  display_order: 6 },
  { name: 'Black IPA', category: 'Hoppy',  display_order: 7 },
  { name: 'Kölsch',    category: 'Lager',  display_order: 13 },
];

// alias → スタイル正式名
const ALIASES = {
  // IPA
  'India Pale Ale': 'IPA', 'American IPA': 'IPA', 'Red IPA': 'IPA',
  'Frozen Fresh Hop IPA': 'IPA', 'Spice IPA': 'IPA', 'Murky IPA': 'IPA',
  // Hazy IPA
  'Hazy Pale Ale': 'Hazy IPA', 'HAZY PALE ALE': 'Hazy IPA', 'Hazy': 'Hazy IPA',
  'Full Power Hazy IPA': 'Hazy IPA', 'Imperial Hazy IPA': 'Hazy IPA',
  // West Coast IPA
  'WCIPA': 'West Coast IPA', 'TDH WCIPA': 'West Coast IPA',
  // Imperial IPA
  'DIPA': 'Imperial IPA', 'Double IPA': 'Imperial IPA', 'W-IPA': 'Imperial IPA',
  'Triple IPA': 'Imperial IPA', 'American DIPA': 'Imperial IPA',
  'West Coast DIPA': 'Imperial IPA', 'West Coast Double IPA': 'Imperial IPA',
  'Hazy Double IPA': 'Imperial IPA', 'DDH Imperial Hazy IPA': 'Imperial IPA',
  'Imperial Hazy DIPA': 'Imperial IPA',
  // Session IPA
  'Cold Session IPA': 'Session IPA',
  // Pale Ale
  'Ale': 'Pale Ale', 'ALE': 'Pale Ale', 'APA': 'Pale Ale',
  'PALE ALE': 'Pale Ale', 'ペールエール': 'Pale Ale',
  'Japanese Pale Ale': 'Pale Ale', 'English Pale Ale': 'Pale Ale',
  'Belgian Pale Ale': 'Pale Ale', 'Light Ale': 'Pale Ale',
  'English Style Ale': 'Pale Ale', 'Special Ale': 'Pale Ale',
  'ゴールドエール': 'Pale Ale', 'エール': 'Pale Ale',
  'Best Bitter': 'Pale Ale', 'English Bitter': 'Pale Ale',
  // Black IPA
  'BLACK IPA': 'Black IPA', 'BLACK ALE': 'Black IPA', 'Black IPA': 'Black IPA',
  'Black Ale': 'Black IPA', 'Darkness': 'Black IPA', 'Black': 'Black IPA',
  'ブラックヴァイツェン': 'Black IPA',
  // Pilsner
  'Pilsener': 'Pilsner', 'PILSNER': 'Pilsner', 'German Pilsner': 'Pilsner',
  'Italian Pilsner': 'Pilsner', 'Neon Pilsner': 'Pilsner', 'Czech Pilsner': 'Pilsner',
  'West Coast Pilsner': 'Pilsner', 'ピルスナー': 'Pilsner', 'ピルス': 'Pilsner',
  'ビルスナー': 'Pilsner', 'ITALIAN-STYLE PILS': 'Pilsner', 'ITALIAN-STYLE PILSIL': 'Pilsner',
  // Lager
  'LAGER': 'Lager', 'ラガー': 'Lager', 'Hazy Lager': 'Lager',
  'Dry Lager': 'Lager', 'Mexican Lager': 'Lager', 'Rice Lager': 'Lager',
  'Premium Lager': 'Lager', 'Dark Lager': 'Lager',
  // Helles
  'ヘルス': 'Helles',
  // Kölsch
  'Hoppy Kölsch': 'Kölsch', 'Kolsch': 'Kölsch',
  // Hefeweizen
  'Weizen': 'Hefeweizen', 'Weiss': 'Hefeweizen', 'ヴァイツェン': 'Hefeweizen',
  'ヴァイヘン': 'Hefeweizen',
  // Witbier
  'Belgian Wit': 'Witbier', 'Belgian White': 'Witbier', 'White Ale': 'Witbier',
  'Belgian Wit w/ Cherry': 'Witbier',
  // Saison
  'Farmhouse': 'Saison', 'Hoppy Saison': 'Saison',
  'Saison w/ Yuzu & Sorachi Ace': 'Saison', 'Saison Gruit IPA': 'Saison',
  // Belgian Ale
  'Tripel': 'Belgian Ale', 'Belgian Blonde': 'Belgian Ale', 'Strong Golden Ale': 'Belgian Ale',
  'ベルジャン（Belgique）': 'Belgian Ale',
  // Lambic
  'Lambiek': 'Lambic / Gueuze',
  // Stout
  'Black/Stout': 'Stout', 'Irish Dry Stout': 'Stout', 'NITRO Milk Stout': 'Stout',
  'Jazz (Irish Dry Stout)': 'Stout', 'ギネス（黒）': 'Stout',
  // Porter
  'Honey Porter': 'Porter', 'HONEY PORTER': 'Porter',
  // Sour
  'Sour IPA': 'Sour / Wild Ale', 'Sour Ale': 'Sour / Wild Ale',
  'サワー': 'Sour / Wild Ale', 'Wild Ale with Fruits': 'Sour / Wild Ale',
  'Smoothie Sour Ale': 'Sour / Wild Ale', 'One Head Sour': 'Sour / Wild Ale',
  'Fruit Sour IPA': 'Sour / Wild Ale',
  // Fruit Beer
  'Fruit Ale': 'Fruit Beer', 'フルーツビール': 'Fruit Beer',
  // Cider
  'English Cider': 'Cider',
};

async function run() {
  // 新スタイル追加
  console.log('新スタイル追加...');
  for (const s of NEW_STYLES) {
    const { error } = await supabase.from('styles').insert(s);
    console.log(error ? `  ❌ ${s.name}: ${error.message}` : `  ✅ ${s.name}`);
  }

  // 全スタイルIDマップ取得
  const { data: styles } = await supabase.from('styles').select('id, name');
  const styleMap = Object.fromEntries(styles.map(s => [s.name, s.id]));

  // エイリアス追加
  console.log('\nエイリアス追加...');
  let ok = 0, skip = 0;
  for (const [alias, styleName] of Object.entries(ALIASES)) {
    const style_id = styleMap[styleName];
    if (!style_id) { console.log(`  ⚠️  スタイル未発見: ${styleName}`); continue; }
    const { error } = await supabase.from('style_aliases').upsert({ style_id, alias }, { onConflict: 'alias', ignoreDuplicates: true });
    if (error) { console.log(`  ❌ ${alias}: ${error.message}`); }
    else ok++;
  }
  console.log(`  ${ok}件追加`);

  // 既存beersにstyle_idをマッチング
  console.log('\n既存beers マッチング...');
  const { data: allAliases } = await supabase.from('style_aliases').select('alias, style_id');
  const aliasMap = Object.fromEntries(allAliases.map(a => [a.alias.toLowerCase(), a.style_id]));
  // 直接スタイル名もマップに追加
  for (const s of styles) aliasMap[s.name.toLowerCase()] = s.id;

  const { data: beers } = await supabase.from('beers').select('id, style').is('style_id', null).not('style', 'is', null);
  let matched = 0, unmatched = [];
  for (const beer of beers) {
    const key = beer.style?.trim().toLowerCase();
    if (!key) continue;
    const style_id = aliasMap[key];
    if (style_id) {
      await supabase.from('beers').update({ style_id }).eq('id', beer.id);
      matched++;
    } else {
      unmatched.push(beer.style);
    }
  }

  console.log(`  マッチ: ${matched}件`);
  const unmatchedUniq = [...new Set(unmatched)].sort();
  console.log(`  未マッチ: ${unmatchedUniq.length}種類`);
  if (unmatchedUniq.length) {
    console.log('\n未マッチ一覧（エイリアス追加候補）:');
    unmatchedUniq.forEach(s => console.log(`  "${s}"`));
  }
}

run().catch(console.error);
