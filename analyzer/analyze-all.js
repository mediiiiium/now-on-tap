const { analyzeTapList } = require('./vision');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../data/screenshots');
const OUTPUT_FILE = path.join(__dirname, '../data/tap-lists.json');

async function analyzeAll() {
  const results = {};
  const bars = fs.readdirSync(SCREENSHOTS_DIR);

  for (const bar of bars) {
    const barDir = path.join(SCREENSHOTS_DIR, bar);
    const images = fs.readdirSync(barDir).filter(f => f.endsWith('.png'));
    console.log(`\n📍 ${bar} (${images.length}投稿)`);

    results[bar] = [];

    for (const img of images) {
      const imagePath = path.join(barDir, img);
      const postId = img.replace('.png', '');
      process.stdout.write(`  🔍 ${postId}... `);

      const result = await analyzeTapList(imagePath);
      if (result.is_tap_list) {
        console.log(`✅ タップリスト検出 (${result.beers?.length ?? 0}ビール)`);
        results[bar].push({ postId, ...result });
      } else {
        console.log('⏭  スキップ');
      }
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✅ 保存: ${OUTPUT_FILE}`);
  return results;
}

analyzeAll().catch(console.error);
