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

    entries.push({
      name_ja: name,
      name_en: fields['Brewery'] ?? null,
      prefecture: fields['都道府県'] ?? null,
      website: fields['Web'] ?? null,
      instagram,
      type: fields['形態'] ?? null,
    });
  }
  return entries;
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
