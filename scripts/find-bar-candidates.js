/**
 * alwayslovebeer Google My Maps KMLから未登録バー候補を抽出する
 *
 * Usage:
 *   node scripts/find-bar-candidates.js              # 東京のみ
 *   node scripts/find-bar-candidates.js --all        # 全国
 *   node scripts/find-bar-candidates.js --folder 関東6県
 */
const { DOMParser } = require('@xmldom/xmldom');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const KML_PATH = '/tmp/breweries_kml/doc.kml';

const ALL = process.argv.includes('--all');
const FOLDER_FILTER = (() => {
  const i = process.argv.indexOf('--folder');
  return i >= 0 ? process.argv[i + 1] : null;
})();

function parseKML(kmlPath) {
  const xml = fs.readFileSync(kmlPath, 'utf8');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const folders = Array.from(doc.getElementsByTagName('Folder'));
  const results = [];

  for (const folder of folders) {
    const folderName = folder.getElementsByTagName('name')[0]?.textContent?.trim() ?? '';
    if (!ALL && FOLDER_FILTER && folderName !== FOLDER_FILTER) continue;
    if (!ALL && !FOLDER_FILTER && folderName !== '東京') continue;

    const placemarks = Array.from(folder.getElementsByTagName('Placemark'));
    for (const pm of placemarks) {
      const name = pm.getElementsByTagName('name')[0]?.textContent?.trim() ?? '';
      const desc = pm.getElementsByTagName('description')[0]?.textContent ?? '';

      // Instagram URL抽出
      const igMatch = desc.match(/Instagram:\s*(https?:\/\/www\.instagram\.com\/([^/<\s"]+)\/?)/i);
      const igUrl = igMatch?.[1] ?? null;
      const igUsername = igMatch?.[2]?.replace(/\/$/, '') ?? null;

      // 都道府県
      const prefMatch = desc.match(/都道府県:\s*([^\n<]+)/);
      const prefecture = prefMatch?.[1]?.trim() ?? null;

      // 形態
      const typeMatch = desc.match(/形態:\s*([^\n<]+)/);
      const type = typeMatch?.[1]?.trim() ?? null;

      // Web
      const webMatch = desc.match(/Web:\s*(https?:\/\/[^\s<"]+)/);
      const web = webMatch?.[1]?.trim() ?? null;

      results.push({ name, igUrl, igUsername, prefecture, type, web, folder: folderName });
    }
  }

  return results;
}

async function getRegisteredUsernames() {
  const { data, error } = await supabase.from('bars').select('instagram_username');
  if (error) throw error;
  return new Set(data.map(r => r.instagram_username.toLowerCase()));
}

async function main() {
  console.log('📍 Parsing KML...');
  const all = parseKML(KML_PATH);
  console.log(`  ${all.length} placemarks in selected folders`);

  const withIG = all.filter(p => p.igUsername);
  console.log(`  ${withIG.length} have Instagram`);

  console.log('🗄  Fetching registered bars...');
  const registered = await getRegisteredUsernames();
  console.log(`  ${registered.size} bars already registered`);

  const candidates = withIG.filter(p => !registered.has(p.igUsername.toLowerCase()));
  console.log(`\n✨ ${candidates.length} new candidates\n`);

  // 表示
  for (const c of candidates) {
    console.log(`${c.name}`);
    console.log(`  📸 @${c.igUsername}`);
    if (c.prefecture) console.log(`  📍 ${c.prefecture}`);
    if (c.type) console.log(`  🏷  ${c.type}`);
    if (c.web) console.log(`  🌐 ${c.web}`);
    console.log();
  }

  // CSV出力
  const csv = ['name,instagram_username,instagram_url,prefecture,type,web']
    .concat(candidates.map(c =>
      [c.name, c.igUsername, c.igUrl, c.prefecture ?? '', c.type ?? '', c.web ?? '']
        .map(v => `"${v.replace(/"/g, '""')}"`)
        .join(',')
    ));
  const outPath = `candidates_${ALL ? 'all' : (FOLDER_FILTER ?? '東京')}.csv`;
  fs.writeFileSync(outPath, csv.join('\n'), 'utf8');
  console.log(`💾 Saved to ${outPath}`);
}

main().catch(console.error);
