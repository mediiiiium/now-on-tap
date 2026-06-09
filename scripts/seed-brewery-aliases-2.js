const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // 新規ブルワリー追加
  const newBreweries = [
    { name_en: 'Jokuin Brewing Lab',     prefecture: '東京' },
    { name_en: 'TDM 1874 Brewery',       prefecture: '東京' },
    { name_en: 'Ishinomaki Hop Works',   prefecture: '宮城' },
    { name_en: "Let's Beer Works",       prefecture: '東京' },
    { name_en: 'Soul Bird Brewery',      prefecture: '東京' },
    { name_en: 'Black Tide Brewing',     prefecture: '神奈川' },
    { name_en: 'Kibou no Oka Brewery',   prefecture: '東京' },
    { name_en: 'Two Fingers',            prefecture: '東京' },
    { name_en: "Fuller's",               prefecture: null,  },  // UK
    { name_en: 'Sierra Nevada',          prefecture: null,  },  // US
    { name_en: 'Aspall',                 prefecture: null,  },  // UK
    { name_en: '2SP Brewing',            prefecture: null,  },  // US
    { name_en: 'Prairie Artisan Ales',   prefecture: null,  },  // US
    { name_en: 'Arbor Ales',             prefecture: null,  },  // UK
    { name_en: 'Trap Door Brewing',      prefecture: null,  },  // US
  ];

  const { data: inserted } = await supabase.from('breweries').insert(newBreweries).select('id, name_en');
  console.log('新規追加:', inserted.length, '件');
  const byName = Object.fromEntries(inserted.map(b => [b.name_en, b.id]));

  // エイリアス
  const aliases = [
    // 志賀高原ビール（再マッチ漏れ対応）
    { brewery_id: 369, alias: '志賀高原ビール' },
    { brewery_id: 369, alias: 'SHIGA KOGEN BEER' },
    { brewery_id: 369, alias: '志賀嶺蔵' },
    // うしとら（再マッチ漏れ対応）
    { brewery_id: 111, alias: 'うしとら' },
    { brewery_id: 111, alias: 'うしとらブルワリー' },
    // 横浜ビール（再マッチ漏れ対応）
    { brewery_id: 217, alias: '横浜ビール' },
    { brewery_id: 217, alias: 'YOKOHAMA BEER' },
    // WCB（再マッチ漏れ対応）
    { brewery_id: 726, alias: 'WCB' },
    { brewery_id: 726, alias: 'West Coast Brewing' },
    // T.Y.HARBOR (id: 297)
    { brewery_id: 297, alias: 'T.Y.HARBOR' },
    { brewery_id: 297, alias: 'TY HARBOR' },
    { brewery_id: 297, alias: 'TY.HARBOR' },
    { brewery_id: 297, alias: 'Y.HARBOR' },
    // Jokuin Brewing Lab
    { brewery_id: byName['Jokuin Brewing Lab'], alias: 'Jokun Brewing Lab' },
    { brewery_id: byName['Jokuin Brewing Lab'], alias: 'JOKUN BREWING LAB' },
    { brewery_id: byName['Jokuin Brewing Lab'], alias: 'JOKUIN BREWING LAB' },
    // TDM 1874
    { brewery_id: byName['TDM 1874 Brewery'], alias: 'TDM 1874 BREWERY' },
    { brewery_id: byName['TDM 1874 Brewery'], alias: 'TDM 1874 Brewery' },
    // Ishinomaki Hop Works
    { brewery_id: byName['Ishinomaki Hop Works'], alias: 'ISHINOMAKI HOP WORKS' },
    // Let's Beer Works
    { brewery_id: byName["Let's Beer Works"], alias: "Let's Beer Works" },
    // Soul Bird Brewery
    { brewery_id: byName['Soul Bird Brewery'], alias: 'Soul Bird Brewery' },
    { brewery_id: byName['Soul Bird Brewery'], alias: 'Soul Bird' },
    // Black Tide Brewing
    { brewery_id: byName['Black Tide Brewing'], alias: 'BLACK TIDE BREWING' },
    { brewery_id: byName['Black Tide Brewing'], alias: 'BLACKTIDE BREWING' },
    // Kibou no Oka
    { brewery_id: byName['Kibou no Oka Brewery'], alias: 'KIBOU NO OKA BREWERY' },
    // Two Fingers
    { brewery_id: byName['Two Fingers'], alias: 'TWO FINGERS' },
    // Fuller's
    { brewery_id: byName["Fuller's"], alias: "Fuller's" },
    { brewery_id: byName["Fuller's"], alias: 'Fullers' },
    // Sierra Nevada
    { brewery_id: byName['Sierra Nevada'], alias: 'Sierra Nevada' },
    { brewery_id: byName['Sierra Nevada'], alias: 'SIERRA NEVADA' },
    // Aspall
    { brewery_id: byName['Aspall'], alias: 'Aspall' },
    // 2SP Brewing
    { brewery_id: byName['2SP Brewing'], alias: '2SP Brewing' },
    { brewery_id: byName['2SP Brewing'], alias: '2ND STORY ALE WORKS' },
    { brewery_id: byName['2SP Brewing'], alias: '2nd Story Ale Works' },
    // Prairie Artisan Ales
    { brewery_id: byName['Prairie Artisan Ales'], alias: 'Prairie Artisan Ales' },
    // Arbor Ales
    { brewery_id: byName['Arbor Ales'], alias: 'ARBOR' },
    { brewery_id: byName['Arbor Ales'], alias: 'Arbor Ales' },
    // Trap Door Brewing
    { brewery_id: byName['Trap Door Brewing'], alias: 'Trap Door' },
    { brewery_id: byName['Trap Door Brewing'], alias: 'Trap Door Brewing' },
    { brewery_id: byName['Trap Door Brewing'], alias: 'Trappedoor' },
  ];

  let ok = 0;
  for (const a of aliases) {
    const { error } = await supabase.from('brewery_aliases').upsert(a, { onConflict: 'alias', ignoreDuplicates: true });
    if (error) console.error('❌', a.alias, error.message);
    else ok++;
  }
  console.log('エイリアス:', ok, '件追加');

  // beers.brewery_id 再マッチング
  const { data: allAliases } = await supabase.from('brewery_aliases').select('alias, brewery_id');
  const { data: allBreweries } = await supabase.from('breweries').select('id, name_ja, name_en');
  const lookup = new Map();
  for (const b of allBreweries) {
    if (b.name_ja) lookup.set(b.name_ja.toLowerCase(), b.id);
    if (b.name_en) lookup.set(b.name_en.toLowerCase(), b.id);
  }
  for (const a of allAliases) lookup.set(a.alias.toLowerCase(), a.brewery_id);

  const { data: beers } = await supabase.from('beers').select('id, brewery').is('brewery_id', null).not('brewery', 'is', null);
  let updated = 0;
  for (const beer of beers) {
    const breweryId = lookup.get((beer.brewery || '').toLowerCase().trim());
    if (breweryId) {
      await supabase.from('beers').update({ brewery_id: breweryId }).eq('id', beer.id);
      updated++;
    }
  }
  console.log('brewery_id 追加マッチ:', updated, '件');

  // 残り件数
  const { count } = await supabase.from('beers').select('id', { count: 'exact' }).is('brewery_id', null).not('brewery', 'is', null);
  console.log('未マッチ残り:', count, '件');
}

run().catch(console.error);
