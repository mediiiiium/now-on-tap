const { scrapeFeed } = require('./scraper/feed');
const { analyzeTapList } = require('./analyzer/vision');
const { savePost, upsertBar } = require('./db/supabase');
require('dotenv').config();

async function runPipeline() {
  console.log(`\n🍺 Now On Tap Pipeline 開始 (${new Date().toLocaleString('ja-JP')})`);

  // フィードから新規投稿を取得（スクロール回数で量を調整）
  const posts = await scrapeFeed(8);

  if (posts.length === 0) {
    console.log('新規投稿なし');
    return;
  }

  console.log(`\n🔍 Vision解析 & DB保存 (${posts.length}件)`);

  for (const post of posts) {
    process.stdout.write(`  @${post.username}/${post.postId} (${post.postedAt?.slice(0,10)})... `);

    try {
      // バーをDBに登録（なければ作成）
      await upsertBar(post.username);

      // Vision解析
      const analysis = await analyzeTapList(post.screenshotPath);

      // DB保存
      const result = await savePost({
        instagramUsername: post.username,
        postId: post.postId,
        postUrl: post.postUrl,
        postedAt: post.postedAt,
        isTapList: analysis.is_tap_list,
        beers: analysis.beers,
      });

      if (result.skipped) {
        console.log('⏭  保存済み');
      } else if (analysis.is_tap_list) {
        console.log(`✅ タップリスト (${analysis.beers?.length ?? 0}ビール)`);
      } else {
        console.log('➖ タップリストなし');
      }

    } catch (err) {
      console.error(`❌ ${err.message}`);
    }
  }

  console.log('\n✅ パイプライン完了');
}

if (require.main === module) {
  runPipeline().catch(console.error);
}

module.exports = { runPipeline };
