const { scrapeBar } = require('./scraper/instagram');
const { analyzeTapList } = require('./analyzer/vision');
const { savePost, upsertBar } = require('./db/supabase');
require('dotenv').config();

const BARS = [
  { username: 'p2b.haus', name: 'P2B Haus', area: '吉祥寺' },
  // 追加する店舗はここに
];

async function runPipeline(bars = BARS) {
  console.log(`\n🍺 Now On Tap Pipeline 開始 (${new Date().toLocaleString('ja-JP')})`);

  for (const bar of bars) {
    console.log(`\n📍 ${bar.name} (@${bar.username})`);

    try {
      // バーをDBに登録
      await upsertBar(bar.username, bar.name, bar.area);

      // 最新投稿をスクレイプ
      const posts = await scrapeBar(bar.username);
      console.log(`  取得: ${posts.length}件の新規投稿`);

      // Vision解析 & DB保存
      for (const post of posts) {
        process.stdout.write(`  🔍 ${post.postId} (${post.postedAt?.slice(0,10)})... `);

        const analysis = await analyzeTapList(post.screenshotPath);

        const result = await savePost({
          instagramUsername: bar.username,
          postId: post.postId,
          postUrl: post.url,
          postedAt: post.postedAt,
          isTapList: analysis.is_tap_list,
          beers: analysis.beers,
        });

        if (result.skipped) {
          console.log('⏭  保存済みスキップ');
        } else if (analysis.is_tap_list) {
          console.log(`✅ タップリスト保存 (${analysis.beers?.length ?? 0}ビール)`);
        } else {
          console.log('➖ タップリストなし');
        }
      }

    } catch (err) {
      console.error(`  ❌ エラー: ${err.message}`);
    }
  }

  console.log('\n✅ パイプライン完了');
}

if (require.main === module) {
  runPipeline().catch(console.error);
}

module.exports = { runPipeline };
