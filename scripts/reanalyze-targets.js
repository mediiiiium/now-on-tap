// 指定アカウントのスクリーンショットを再解析してbeersを更新
const { analyzeTapList } = require('../analyzer/vision');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SCREENSHOT_DIR = './data/screenshots';

// コマンドライン引数でアカウント指定、なければ全件
const targetAccounts = process.argv.slice(2);

async function reanalyze() {
  const files = [];
  for (const barDir of fs.readdirSync(SCREENSHOT_DIR)) {
    if (targetAccounts.length > 0 && !targetAccounts.includes(barDir)) continue;
    const dirPath = path.join(SCREENSHOT_DIR, barDir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith('.png')) continue;
      const postId = path.basename(file, '.png');
      files.push({ barUsername: barDir, postId, imagePath: path.join(dirPath, file) });
    }
  }
  console.log(`対象: ${files.length}件\n`);

  let updated = 0, skipped = 0, errors = 0;

  for (const { barUsername, postId, imagePath } of files) {
    process.stdout.write(`@${barUsername}/${postId}... `);

    const { data: post } = await supabase
      .from('posts')
      .select('id, is_tap_list, caption')
      .eq('post_id', postId)
      .single();

    if (!post) { console.log('⏭  DB未登録'); skipped++; continue; }

    try {
      const analysis = await analyzeTapList(imagePath, post.caption ?? null);

      if (!analysis.is_tap_list) {
        if (post.is_tap_list) {
          await supabase.from('posts').update({ is_tap_list: false }).eq('id', post.id);
          await supabase.from('beers').delete().eq('post_id', post.id);
          console.log('🔄 is_tap_list false に修正');
          updated++;
        } else {
          console.log('⏭  タップリストなし');
          skipped++;
        }
        continue;
      }

      await supabase.from('beers').delete().eq('post_id', post.id);
      if (analysis.beers.length > 0) {
        const rows = analysis.beers.map(b => ({
          post_id: post.id,
          instagram_username: barUsername,
          name: b.name,
          name_ja: b.name_ja ?? null,
          name_en: b.name_en ?? null,
          brewery: b.brewery,
          brewery_en: b.brewery_en ?? null,
          style: b.style,
          abv: b.abv,
          price: b.price,
          notes: b.notes,
        }));
        await supabase.from('beers').insert(rows);
      }
      await supabase.from('posts').update({ is_tap_list: true }).eq('id', post.id);
      console.log(`✅ ${analysis.beers.length}件`);
      updated++;

    } catch (err) {
      console.log('❌', err.message);
      errors++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n完了 — 更新: ${updated} / スキップ: ${skipped} / エラー: ${errors}`);
}

reanalyze().catch(console.error);
