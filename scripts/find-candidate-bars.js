// 既存フォロー中バーのフォロー先から、新規候補アカウントを抽出する
const { getFollowing } = require('../scraper/following');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// クラフトビール関連キーワード（bio等には使えないが、スクリーニング用）
const SKIP_KEYWORDS = ['official', 'brewery', 'brewing', 'brewer'];

async function run() {
  // 現在フォロー中のアカウント一覧（now_on_tap のフォロー = 登録済みバー）
  console.log('now_on_tap のフォローリスト取得中...');
  const following = await getFollowing(process.env.INSTAGRAM_USERNAME);
  const followingSet = new Set(following);
  console.log(`現在フォロー中: ${following.length}件\n`);

  // DBに登録済みのアカウント
  const { data: bars } = await supabase.from('bars').select('instagram_username');
  const knownSet = new Set(bars.map(b => b.instagram_username));

  // 各バーのフォロー先を収集（頻度カウント）
  const candidateCount = new Map(); // username → 何店がフォローしているか
  const candidateFollowedBy = new Map(); // username → どの店がフォローしているか

  const LIMIT = parseInt(process.argv[2] || '0') || following.length;
  for (let i = 0; i < Math.min(LIMIT, following.length); i++) {
    const account = following[i];
    console.log(`[${i + 1}/${following.length}] @${account} のフォロー先を取得中...`);
    try {
      const theirFollowing = await getFollowing(account);
      for (const candidate of theirFollowing) {
        if (followingSet.has(candidate)) continue; // 既存フォロー済みはスキップ
        if (candidate === process.env.INSTAGRAM_USERNAME) continue;
        candidateCount.set(candidate, (candidateCount.get(candidate) || 0) + 1);
        if (!candidateFollowedBy.has(candidate)) candidateFollowedBy.set(candidate, []);
        candidateFollowedBy.get(candidate).push(account);
      }
    } catch (e) {
      console.error(`  ❌ @${account}: ${e.message}`);
    }
    // レート制限対策
    await new Promise(r => setTimeout(r, 2000));
  }

  // 2店以上がフォローしているアカウントを候補とする
  const candidates = Array.from(candidateCount.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([username, count]) => ({
      username,
      count,
      followedBy: candidateFollowedBy.get(username),
    }));

  console.log(`\n候補: ${candidates.length}件（2店以上がフォロー）\n`);
  candidates.forEach(c => {
    console.log(`${c.count}店: @${c.username} (${c.followedBy.join(', ')})`);
  });

  // CSVで保存
  const csv = 'username,followed_by_count,followed_by\n' +
    candidates.map(c => `${c.username},${c.count},"${c.followedBy.join('|')}"`).join('\n');
  fs.writeFileSync('./data/candidate_bars.csv', csv);
  console.log('\n→ data/candidate_bars.csv に保存しました');
}

run().catch(console.error);
