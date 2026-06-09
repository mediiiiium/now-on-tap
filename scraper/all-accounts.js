// フォロー中の全アカウントを巡回してDBに登録
const { scrapeBar } = require('./instagram');
const { analyzeTapList } = require('../analyzer/vision');
const { savePost, upsertBar } = require('../db/supabase');
const { getFollowing } = require('./following');
require('dotenv').config();

async function scrapeAllAccounts() {
  console.log(`\n🔄 全アカウント巡回開始 (${new Date().toLocaleString('ja-JP')})`);

  const username = process.env.INSTAGRAM_USERNAME;
  const accounts = await getFollowing(username);
  console.log(`対象: ${accounts.length}アカウント\n`);

  for (const account of accounts) {
    console.log(`📍 @${account}`);
    try {
      await upsertBar(account);
      const posts = await scrapeBar(account);
      console.log(`  取得: ${posts.length}件の新規投稿`);

      for (const post of posts) {
        process.stdout.write(`  🔍 ${post.postId}... `);
        const analysis = await analyzeTapList(post.screenshotPath);
        const result = await savePost({
          instagramUsername: account,
          postId: post.postId,
          postUrl: post.url,
          postedAt: post.postedAt,
          isTapList: analysis.is_tap_list,
          beers: analysis.beers,
        });

        if (result.skipped) {
          console.log('⏭  スキップ');
        } else if (analysis.is_tap_list) {
          console.log(`✅ タップリスト (${analysis.beers?.length ?? 0}ビール)`);
        } else {
          console.log('➖ タップリストなし');
        }
      }
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
    }

    // アカウント間は少し待つ
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
  }

  console.log('\n✅ 全アカウント巡回完了');
}

if (require.main === module) {
  scrapeAllAccounts().catch(console.error);
}

module.exports = { scrapeAllAccounts };
