// breweries_master.json → Supabase breweries テーブルに投入
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function seedBreweries() {
  const raw = JSON.parse(fs.readFileSync('./data/breweries_master.json', 'utf-8'));

  // クリーニング：name_ja / name_en のどちらかが必要、短すぎるものは除外
  const valid = raw.filter(b => {
    const name = b.name_ja || b.name_en || '';
    return name.length >= 3 && !['BREWING', 'ス', 'ルーイング'].includes(name);
  });

  console.log(`投入対象: ${valid.length}件`);

  // 100件ずつバッチ挿入
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH).map(b => ({
      name_ja: b.name_ja || null,
      name_en: b.name_en || null,
      prefecture: b.prefecture || null,
    }));
    const { error } = await supabase.from('breweries').insert(batch);
    if (error) {
      console.error(`❌ バッチ${i}-${i+BATCH}: ${error.message}`);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  ${inserted}/${valid.length}件投入済み...`);
    }
  }

  // エイリアスとして name_en / name_ja 両方を登録
  console.log('\nエイリアス登録中...');
  const { data: allBreweries } = await supabase.from('breweries').select('id, name_ja, name_en');

  const aliases = [];
  for (const b of allBreweries) {
    if (b.name_en && b.name_ja) {
      // 両方ある場合、互いをエイリアスとして登録
      aliases.push({ brewery_id: b.id, alias: b.name_en });
      aliases.push({ brewery_id: b.id, alias: b.name_ja });
    } else if (b.name_en) {
      aliases.push({ brewery_id: b.id, alias: b.name_en });
    } else if (b.name_ja) {
      aliases.push({ brewery_id: b.id, alias: b.name_ja });
    }
  }

  for (let i = 0; i < aliases.length; i += BATCH) {
    const batch = aliases.slice(i, i + BATCH);
    await supabase.from('brewery_aliases').upsert(batch, { onConflict: 'alias', ignoreDuplicates: true });
  }

  console.log(`\n✅ 完了: ${inserted}件のブルワリーを登録しました`);
}

seedBreweries().catch(console.error);
