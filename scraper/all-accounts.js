// 全アカウントを巡回してDBに登録
const { scrapeBar } = require('./instagram');
const { analyzeTapList } = require('../analyzer/vision');
const { savePost, upsertBar, getBar, markBarClosed } = require('../db/supabase');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function getAllBarAccounts() {
  const { data, error } = await supabase
    .from('bars')
    .select('instagram_username')
    .eq('status', 'active')
    .order('instagram_username');
  if (error) throw error;
  return data.map(r => r.instagram_username);
}

async function notifySlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

async function scrapeAllAccounts() {
  console.log(`\n🔄 全アカウント巡回開始 (${new Date().toLocaleString('ja-JP')})`);

  const accounts = await getAllBarAccounts();
  console.log(`対象: ${accounts.length}アカウント\n`);

  const INACTIVE_DAYS = 90;
  const closedCandidates = [];

  for (const account of accounts) {
    console.log(`📍 @${account}`);
    try {
      await upsertBar(account);
      const { posts, bioLinks } = await scrapeBar(account);
      console.log(`  取得: ${posts.length}件の新規投稿`);

      // bio に Untappd URL があれば保存
      const untappdUrl = bioLinks.find(l => l.includes('untappd.com'));
      if (untappdUrl) {
        const { data: bar } = await supabase.from('bars').select('untappd_url').eq('instagram_username', account).single();
        if (!bar?.untappd_url) {
          await supabase.from('bars').update({ untappd_url: untappdUrl }).eq('instagram_username', account);
          console.log(`  🍺 Untappd URL 登録: ${untappdUrl}`);
        }
      }

      // 最終投稿日チェック（投稿0件かつ last_scraped_at が初回以外の場合）
      if (posts.length === 0) {
        const bar = await getBar(account);
        if (bar?.last_scraped_at) {
          const daysSince = (Date.now() - new Date(bar.last_scraped_at).getTime()) / 86400000;
          if (daysSince > INACTIVE_DAYS) {
            closedCandidates.push(account);
          }
        }
      }

      for (const post of posts) {
        process.stdout.write(`  🔍 ${post.postId}... `);
        const analysis = await analyzeTapList(post.screenshotPath, post.caption ?? null);
        const result = await savePost({
          instagramUsername: account,
          postId: post.postId,
          postUrl: post.url,
          postedAt: post.postedAt,
          caption: post.caption ?? null,
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
      if (err.message === 'SESSION_EXPIRED') {
        await notifySlack('🚨 *Instagram セッション切れ* — 再ログインが必要です。\n`node scraper/instagram.js <account>` を実行してセッションを更新してください。');
        console.error('\n🚨 Instagramセッション切れ。処理を中断します。');
        process.exit(1);
      }
      console.error(`  ❌ ${err.message}`);
      // アカウント取得失敗 = 削除・非公開の可能性
      if (err.message.includes('404') || err.message.includes('not found') || err.message.includes('private')) {
        closedCandidates.push(account);
      }
    }

    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
  }

  // 閉店候補をSlack通知
  if (closedCandidates.length > 0) {
    const msg = `⚠️ *閉店・非公開の可能性があるアカウント（要確認）*\n${closedCandidates.map(a => `• @${a}`).join('\n')}\n確認後 \`UPDATE bars SET status = 'closed' WHERE instagram_username = '...';\` で対応してください`;
    await notifySlack(msg);
    console.log(`\n⚠️  閉店候補: ${closedCandidates.join(', ')}`);
  }

  console.log('\n✅ 全アカウント巡回完了');
}

if (require.main === module) {
  scrapeAllAccounts().catch(console.error);
}

module.exports = { scrapeAllAccounts };
