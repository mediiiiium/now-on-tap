// Instagramのフォローリストをbarsテーブルに同期するスクリプト
// 新しくフォローしたバーを自動登録する
const { getFollowing } = require('../scraper/following');
const { upsertBar } = require('../db/supabase');
require('dotenv').config();

async function syncFollowing() {
  const username = process.env.INSTAGRAM_USERNAME;
  if (!username) throw new Error('INSTAGRAM_USERNAME が設定されていません');

  console.log(`\n🔄 フォローリスト同期開始 (@${username})`);

  const following = await getFollowing(username);
  console.log(`フォロー中: ${following.length} アカウント`);

  for (const account of following) {
    try {
      await upsertBar(account);
      process.stdout.write('.');
    } catch (err) {
      console.error(`\n❌ @${account}: ${err.message}`);
    }
  }

  console.log(`\n✅ 同期完了 (${following.length} アカウント処理)`);
}

if (require.main === module) {
  syncFollowing().catch(console.error);
}

module.exports = { syncFollowing };
