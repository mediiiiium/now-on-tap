const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// instagram_username → { name, area } の対応表
// name が null のものは未設定（要確認）
const barData = [
  { username: 'p2b.haus',                 name: 'P2B.HAUS',                  area: null },
  { username: 'wateringhole_jp',           name: 'Watering Hole',              area: null },
  { username: 'tokisushi_tbs',             name: 'Toki Sushi TBS',             area: '赤坂' },
  { username: 'kiyo.kiyokokko',            name: null,                         area: null },
  { username: 'okei_brewery_nippori',      name: 'Okei Brewery',               area: '日暮里' },
  { username: 'masatoshi_nakazawa',        name: null,                         area: null },
  { username: 'kumasuke902',               name: null,                         area: null },
  { username: 'beerpub_ishii',             name: 'Beer Pub Ishii',             area: null },
  { username: 'citraba.yaesu',             name: 'Citraba',                    area: '八重洲' },
  { username: 'p_144.ikebukuro',           name: 'P.144',                      area: '池袋' },
  { username: 'citraba_nakano',            name: 'Citraba',                    area: '中野' },
  { username: 'citraba_koenji',            name: 'Citraba',                    area: '高円寺' },
  { username: 'clann_bytheriver',          name: 'Clann by the River',         area: null },
  { username: 'twofingers.craftbeer',      name: 'Two Fingers',                area: null },
  { username: 'vivo.ikebukuro',            name: 'VIVO',                       area: '池袋' },
  { username: 'fam333_craft_beer_tap',     name: 'FAM333',                     area: null },
  { username: 'number6tokyo',              name: 'Number Six Tokyo',           area: null },
  { username: 'theworldend_irishpub',      name: 'The World End',              area: null },
  { username: 'goodconditionstand',        name: 'Good Condition Stand',       area: null },
  { username: 'beerolyn',                  name: 'Beerolyn',                   area: null },
  { username: 'soulbird_hamamatsucho',     name: 'Soul Bird',                  area: '浜松町' },
  { username: 'beerbomb_shinjuku',         name: 'Beer Bomb',                  area: '新宿' },
  { username: 'btaps_toranomon',           name: 'B-TAPS',                     area: '虎ノ門' },
  { username: 'beerboy.parco',             name: 'Beer Boy',                   area: null },
  { username: 'mitaka_nekozarashi',        name: 'ねこざらし',                  area: '三鷹' },
  { username: 'tullamore_irish_pub',       name: 'Tullamore',                  area: null },
  { username: 'neighbor_2024',             name: 'Neighbor',                   area: null },
  { username: 'himalaya_table',            name: 'Himalaya Table',             area: null },
  { username: 'hiranoya1907',              name: '平野屋',                      area: null },
  { username: 'underground_craft_beer',    name: 'Underground Craft Beer',     area: null },
  { username: 'cedarmountainshop',         name: 'Cedar Mountain',             area: null },
  { username: 'beerbarbitter',             name: 'Beer Bar Bitter',            area: null },
  { username: 'bellycraftinfo',            name: 'Belly Craft',                area: null },
  { username: 'beerotaku_spice',           name: 'Beer Otaku Spice',           area: null },
  { username: 'the_grafton_beer_pub',      name: 'The Grafton',                area: null },
  { username: 'beerpubscent',              name: 'Beer Pub Scent',             area: null },
  { username: 'craft_beer_2mugi',          name: 'CraftBeer 2むぎ',            area: null },
  { username: 'kanpai_stand_shibuya',      name: 'Kanpai Stand',               area: '渋谷' },
  { username: 'karafa_beer',               name: 'Karafa Beer',                area: null },
  { username: 'beerbrain_harajuku',        name: 'Beer Brain',                 area: '原宿' },
  { username: 'hakobune_dome',             name: '箱舟',                        area: '後楽園' },
  { username: 'cbm_tokyodomecity',         name: 'Craft Beer Market',          area: '東京ドームシティ' },
  { username: 'cbm_tokyotorch',            name: 'Craft Beer Market',          area: '東京トーチ' },
  { username: 'cbm_kichijoji_pennylane',   name: 'Craft Beer Market',          area: '吉祥寺ペニーレーン' },
  { username: 'cbm_jimbocho',              name: 'Craft Beer Market',          area: '神保町' },
  { username: 'cbm_mitsukoshimae',         name: 'Craft Beer Market',          area: '三越前' },
  { username: 'cbm_kichijoji',             name: 'Craft Beer Market',          area: '吉祥寺' },
  { username: 'cbm_otemachi',              name: 'Craft Beer Market',          area: '大手町' },
  { username: 'cbmkanda',                  name: 'Craft Beer Market',          area: '神田' },
  { username: 'cbm_tamachi',               name: 'Craft Beer Market',          area: '田町' },
  { username: 'cbm_toranomon',             name: 'Craft Beer Market',          area: '虎ノ門' },
  { username: 'shinbashiibrew',            name: 'iBrew',                      area: '新橋' },
  { username: 'ibrew_ginza',               name: 'iBrew',                      area: '銀座' },
  { username: 'ibrew_ebisu_official',      name: 'iBrew',                      area: '恵比寿' },
  { username: 'ibrew_akihabara',           name: 'iBrew',                      area: '秋葉原' },
  { username: 'okei_tap',                  name: 'Okei Tap',                   area: null },
  { username: 'beershopllama',             name: 'Beer Shop Llama',            area: null },
];

async function seedBarNames() {
  let updated = 0, skipped = 0;
  for (const bar of barData) {
    if (!bar.name) { skipped++; continue; }
    const { error } = await supabase
      .from('bars')
      .update({ name: bar.name, area: bar.area })
      .eq('instagram_username', bar.username);
    if (error) {
      console.error(`❌ @${bar.username}: ${error.message}`);
    } else {
      console.log(`✅ @${bar.username} → ${bar.name}${bar.area ? ` (${bar.area})` : ''}`);
      updated++;
    }
  }
  console.log(`\n完了: ${updated}件更新, ${skipped}件スキップ（要確認）`);
}

seedBarNames().catch(console.error);
