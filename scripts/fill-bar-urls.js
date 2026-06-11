/**
 * Google Maps KML から website_url / google_maps_url を取得して bars テーブルを補完
 * 既存の値は上書きしない
 */
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const KML_URL = 'https://www.google.com/maps/d/kml?mid=1DaSgYBnJZnlWFmNFqvvHFqP6G_MxKGP4&forcekml=1';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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
  const results = [];

  for (const p of placemarks) {
    const desc = p.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? '';
    const fields = {};
    for (const part of desc.split('<br>')) {
      const idx = part.indexOf(': ');
      if (idx > 0) fields[part.slice(0, idx).trim()] = part.slice(idx + 2).trim();
    }

    const igMatch = (fields['Instagram'] ?? '').match(/instagram\.com\/([^/?"\s]+)/);
    const instagram = igMatch ? igMatch[1].replace(/\/$/, '') : null;
    if (!instagram) continue;

    const websiteUrl = fields['Web']?.trim() || null;

    // 座標から Google Maps URL を生成
    const coordMatch = p.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    let googleMapsUrl = null;
    if (coordMatch) {
      const parts = coordMatch[1].trim().split(',');
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      }
    }

    results.push({ instagram, websiteUrl, googleMapsUrl });
  }

  return results;
}

async function main() {
  console.log('KML 取得中...');
  const xml = await fetchKml();
  const entries = parseKml(xml);
  console.log(`${entries.length}件パース完了`);

  const { data: bars } = await sb.from('bars').select('instagram_username, website_url, google_maps_url');
  const barsMap = new Map((bars ?? []).map(b => [b.instagram_username.toLowerCase(), b]));

  let updated = 0, skipped = 0;

  for (const entry of entries) {
    const bar = barsMap.get(entry.instagram.toLowerCase());
    if (!bar) continue;

    const updates = {};
    if (!bar.website_url && entry.websiteUrl) updates.website_url = entry.websiteUrl;
    if (!bar.google_maps_url && entry.googleMapsUrl) updates.google_maps_url = entry.googleMapsUrl;

    if (Object.keys(updates).length === 0) { skipped++; continue; }

    const { error } = await sb.from('bars').update(updates).eq('instagram_username', bar.instagram_username);
    if (error) { console.error(`❌ ${bar.instagram_username}: ${error.message}`); continue; }

    console.log(`✅ @${bar.instagram_username}: ${Object.keys(updates).join(', ')}`);
    updated++;
  }

  console.log(`\n完了: ${updated}件更新 / ${skipped}件スキップ（既存値あり or KMLにデータなし）`);
}

main().catch(console.error);
