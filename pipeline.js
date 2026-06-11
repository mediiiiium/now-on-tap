const { scrapeFeed } = require('./scraper/feed');
const { analyzeTapList } = require('./analyzer/vision');
const { savePost, getBar } = require('./db/supabase');
require('dotenv').config();

async function sendSlack(message) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
}

async function runPipeline() {
  console.log(`\n🍻 Now On Tap Pipeline 開始 (${new Date().toLocaleString('ja-JP')})`);

  const stats = { scraped: 0, tapLists: 0, beers: 0, errors: 0 };

  const posts = await scrapeFeed(8);

  if (posts.length === 0) {
    console.log('新規投稿なし');
    await sendSlack(`🍻 *Now On Tap* — 本日の新規投稿なし`);
    return;
  }

  console.log(`\n🔍 Vision解析 & DB保存 (${posts.length}件)`);
  stats.scraped = posts.length;

  for (const post of posts) {
    process.stdout.write(`  @${post.username}/${post.postId} (${post.postedAt?.slice(0,10)})... `);

    try {
      // barsテーブルに登録済みのアカウント（フォロー中）のみ処理
      const bar = await getBar(post.username);
      if (!bar) {
        console.log(`⏭  @${post.username} はフォロー外のためスキップ`);
        continue;
      }

      const analysis = await analyzeTapList(post.screenshotPath, post.caption ?? null);
      const result = await savePost({
        instagramUsername: bar.instagram_username,
        postId: post.postId,
        postUrl: post.postUrl,
        postedAt: post.postedAt,
        caption: post.caption ?? null,
        isTapList: analysis.is_tap_list,
        beers: analysis.beers,
      });

      if (result.skipped) {
        console.log('⏭  保存済み');
      } else if (analysis.is_tap_list) {
        stats.tapLists++;
        stats.beers += analysis.beers?.length ?? 0;
        console.log(`✅ タップリスト (${analysis.beers?.length ?? 0}ビール)`);
      } else {
        console.log('➖ タップリストなし');
      }

    } catch (err) {
      stats.errors++;
      console.error(`❌ ${err.message}`);
    }
  }

  console.log('\n✅ パイプライン完了');

  // エラーがあった場合のみSlack通知
  if (stats.errors > 0) {
    await sendSlack(`⚠️ *Now On Tap* — ${new Date().toLocaleDateString('ja-JP')} エラー${stats.errors}件発生\n　新規投稿: ${stats.scraped}件 / タップリスト: ${stats.tapLists}件`);
  }
}

if (require.main === module) {
  runPipeline().catch(console.error);
}

module.exports = { runPipeline };
