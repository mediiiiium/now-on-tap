/**
 * Google My Maps KML からブルワリーを breweries テーブルに投入する
 * 同時に東京のブルーパブデータで bars テーブルを補完する
 *
 * Usage:
 *   node scripts/import-breweries-from-kml.js           # 全国breweries投入
 *   node scripts/import-breweries-from-kml.js --bars    # 東京bars補完のみ
 *   node scripts/import-breweries-from-kml.js --dry-run
 */
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const BARS_ONLY = process.argv.includes('--bars');

const KML_URL = 'https://www.google.com/maps/d/kml?mid=1DaSgYBnJZnlWFmNFqvvHFqP6G_MxKGP4&forcekml=1';

function fetchKml() {
  return new Promise((resolve, reject) => {
    https.get(KML_URL, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseKml(xml) {
  const placemarks = xml.split('<Placemark>').slice(1);
  const entries = [];

  for (const p of placemarks) {
    const nameMatch = p.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/) ?? p.match(/<name>(.*?)<\/name>/);
    const descMatch = p.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ?? p.match(/<description>([\s\S]*?)<\/description>/);
    const name = nameMatch?.[1]?.trim() ?? '';
    const desc = descMatch?.[1] ?? '';

    const fields = {};
    for (const part of desc.split('<br>')) {
      const idx = part.indexOf(': ');
      if (idx > 0) fields[part.slice(0, idx).trim()] = part.slice(idx + 2).trim();
    }

    const igMatch = (fields['Instagram'] ?? '').match(/instagram\.com\/([^/?"\s]+)/);
    const instagram = igMatch ? igMatch[1].replace(/\/$/, '') : null;
    const address = fields['住所'] ?? '';

    entries.push({
      name_ja: name,
      name_en: fields['Brewery'] ?? null,
      prefecture: fields['都道府県'] ?? null,
      website: fields['Web'] ?? fields['Webサイト'] ?? null,
      instagram,
      type: fields['形態'] ?? null,
      address,
    });
  }
  return entries;
}

const AREA_MAP = [
  { area: '渋谷',     keywords: ['渋谷区渋谷', '渋谷区道玄坂', '渋谷区神泉', '渋谷区代官山', '渋谷区北参道'] },
  { area: '原宿',     keywords: ['渋谷区神宮前', '渋谷区原宿', '渋谷区表参道'] },
  { area: '恵比寿',   keywords: ['渋谷区恵比寿', '渋谷区広尾'] },
  { area: '目黒',     keywords: ['目黒区目黒', '目黒区中目黒', '目黒区祐天寺'] },
  { area: '五反田',   keywords: ['品川区西五反田', '品川区東五反田'] },
  { area: '武蔵小山', keywords: ['品川区小山'] },
  { area: '自由が丘', keywords: ['目黒区自由が丘', '世田谷区奥沢'] },
  { area: '下北沢',   keywords: ['世田谷区北沢', '世田谷区代沢'] },
  { area: '三軒茶屋', keywords: ['世田谷区太子堂', '世田谷区三軒茶屋'] },
  { area: '二子玉川', keywords: ['世田谷区玉川'] },
  { area: '新宿',     keywords: ['新宿区新宿', '新宿区歌舞伎町', '新宿区西新宿'] },
  { area: '代々木',   keywords: ['渋谷区代々木', '新宿区代々木'] },
  { area: '笹塚',     keywords: ['渋谷区笹塚', '渋谷区幡ヶ谷'] },
  { area: '池袋',     keywords: ['豊島区南池袋', '豊島区西池袋', '豊島区東池袋'] },
  { area: '大塚',     keywords: ['豊島区北大塚', '豊島区南大塚'] },
  { area: '高田馬場', keywords: ['新宿区高田馬場', '新宿区百人町'] },
  { area: '早稲田',   keywords: ['新宿区早稲田'] },
  { area: '銀座',     keywords: ['中央区銀座'] },
  { area: '有楽町',   keywords: ['千代田区有楽町', '千代田区日比谷'] },
  { area: '八重洲',   keywords: ['中央区八重洲', '千代田区丸の内', '千代田区大手町'] },
  { area: '三越前',   keywords: ['中央区日本橋'] },
  { area: '神田',     keywords: ['千代田区神田', '千代田区外神田'] },
  { area: '秋葉原',   keywords: ['台東区秋葉原', '千代田区外神田'] },
  { area: '神保町',   keywords: ['千代田区神田神保町', '千代田区神田小川町'] },
  { area: '飯田橋',   keywords: ['新宿区神楽坂', '新宿区矢来町', '千代田区飯田橋'] },
  { area: '人形町',   keywords: ['中央区日本橋人形町', '中央区日本橋浜町'] },
  { area: '水道橋',   keywords: ['文京区後楽', '千代田区三崎町'] },
  { area: '虎ノ門',   keywords: ['港区虎ノ門', '港区愛宕'] },
  { area: '新橋',     keywords: ['港区新橋', '港区西新橋'] },
  { area: '麻布十番', keywords: ['港区麻布十番', '港区六本木', '港区南麻布'] },
  { area: '浜松町',   keywords: ['港区浜松町', '港区芝'] },
  { area: '品川',     keywords: ['品川区北品川', '品川区東品川', '港区高輪'] },
  { area: '大森',     keywords: ['大田区大森', '大田区山王', '大田区蒲田'] },
  { area: '上野',     keywords: ['台東区上野', '台東区東上野'] },
  { area: '浅草',     keywords: ['台東区浅草', '台東区花川戸', '台東区蔵前'] },
  { area: '日暮里',   keywords: ['荒川区西日暮里', '荒川区東日暮里'] },
  { area: '御徒町',   keywords: ['台東区上野'] },
  { area: '赤羽',     keywords: ['北区赤羽'] },
  { area: '十条',     keywords: ['北区中十条', '北区上十条'] },
  { area: '清澄白河', keywords: ['江東区白河', '江東区清澄'] },
  { area: '森下',     keywords: ['江東区森下', '墨田区両国'] },
  { area: '押上',     keywords: ['墨田区押上', '墨田区業平'] },
  { area: '門前仲町', keywords: ['江東区門前仲町', '江東区富岡'] },
  { area: '立石',     keywords: ['葛飾区立石'] },
  { area: '中野',     keywords: ['中野区中野', '中野区東中野'] },
  { area: '高円寺',   keywords: ['杉並区高円寺'] },
  { area: '阿佐ヶ谷', keywords: ['杉並区阿佐谷'] },
  { area: '吉祥寺',   keywords: ['武蔵野市吉祥寺'] },
  { area: '三鷹',     keywords: ['三鷹市', '武蔵野市境'] },
  { area: '国立',     keywords: ['国立市'] },
  { area: '立川',     keywords: ['立川市'] },
  { area: '八王子',   keywords: ['八王子市'] },
  { area: '昭島',     keywords: ['昭島市'] },
];

function addressToArea(address) {
  if (!address) return null;
  for (const { area, keywords } of AREA_MAP) {
    if (keywords.some(k => address.includes(k))) return area;
  }
  return null;
}

function prefectureLabel(pref) {
  if (!pref) return null;
  if (pref === '東京') return '東京都';
  if (['北海道', '大阪府', '京都府'].includes(pref + '府') || pref.endsWith('道') || pref.endsWith('府')) return pref;
  if (pref === '大阪' || pref === '京都') return pref + '府';
  return pref + '県';
}

async function insertBrewery(entry) {
  const name = entry.name_en || entry.name_ja;
  if (!name || name.length < 2) return null;

  const row = {
    name,
    name_ja: entry.name_ja || null,
    prefecture: prefectureLabel(entry.prefecture),
    country: 'JP',
    website_url: entry.website || null,
  };

  // name_ja で既存チェック（英語名なしの場合に重複防止）
  if (entry.name_ja) {
    const { data: byJa } = await supabase.from('breweries').select('id, website_url').eq('name_ja', entry.name_ja).single();
    if (byJa) {
      if (!byJa.website_url && entry.website) {
        await supabase.from('breweries').update({ website_url: entry.website }).eq('id', byJa.id);
      }
      return byJa.id;
    }
  }

  const { data, error } = await supabase.from('breweries').insert(row).select('id').single();
  if (error) {
    if (error.code === '23505') {
      const { data: ex } = await supabase.from('breweries').select('id, website_url').eq('name', name).single();
      // website_url が未設定なら補完
      if (ex && !ex.website_url && entry.website) {
        await supabase.from('breweries').update({ website_url: entry.website }).eq('id', ex.id);
      }
      return ex?.id ?? null;
    }
    throw error;
  }
  return data.id;
}

async function updateBar(username, updates) {
  const { error } = await supabase.from('bars').update(updates).eq('instagram_username', username);
  if (error) throw error;
}

async function main() {
  console.log('📄 Fetching KML...');
  const xml = await fetchKml();
  const entries = parseKml(xml);
  console.log(`  ${entries.length} placemarks`);

  if (!BARS_ONLY) {
    // --- breweries 全国投入 ---
    console.log('\n🍺 Inserting breweries (all Japan)...');
    let ok = 0, skip = 0, fail = 0;
    for (const entry of entries) {
      if (DRY_RUN) {
        console.log(`  [${entry.prefecture}] ${entry.name_en ?? entry.name_ja} (${entry.type})`);
        ok++;
        continue;
      }
      try {
        const id = await insertBrewery(entry);
        if (id) ok++; else skip++;
      } catch (e) {
        console.error(`  ✗ ${entry.name_en ?? entry.name_ja}: ${e.message}`);
        fail++;
      }
    }
    console.log(`  Done: ${ok} inserted, ${skip} skipped, ${fail} failed`);
  }

  // --- 東京bars補完 ---
  console.log('\n🏪 Enriching Tokyo bars...');
  const tokyoBars = entries.filter(e => e.prefecture === '東京' && e.type !== 'ブルワリー');

  // barsテーブル取得
  const { data: bars } = await supabase.from('bars').select('instagram_username, name, name_en, area');
  const barMap = Object.fromEntries(bars.map(b => [b.instagram_username, b]));

  let barUpdated = 0, barMissed = 0;
  for (const entry of tokyoBars) {
    if (!entry.instagram) { barMissed++; continue; }
    const bar = barMap[entry.instagram];
    if (!bar) { barMissed++; continue; }

    const updates = {};
    if (!bar.name_en && entry.name_en) updates.name_en = entry.name_en;
    if (!bar.name && entry.name_ja) updates.name = entry.name_ja;
    if (!bar.area) {
      const area = addressToArea(entry.address);
      if (area) updates.area = area;
    }
    // 住所からエリア補完は別途

    if (Object.keys(updates).length === 0) continue;

    if (DRY_RUN) {
      console.log(`  @${entry.instagram}: ${JSON.stringify(updates)}`);
    } else {
      try {
        await updateBar(entry.instagram, updates);
        barUpdated++;
      } catch (e) {
        console.error(`  ✗ @${entry.instagram}: ${e.message}`);
      }
    }
  }
  console.log(`  ${barUpdated} bars updated, ${barMissed} unmatched`);
}

main().catch(console.error);
