// 1ヶ月以上タップリストが抽出できていないアカウントのアラートレポート
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function alertReport() {
  // 全アカウントの投稿状況を集計
  const { data, error } = await supabase.rpc('tap_list_alert_report');

  if (error) {
    // RPCがなければSQLで直接取得
    return await alertReportDirect();
  }
  return data;
}

async function alertReportDirect() {
  const { data, error } = await supabase
    .from('posts')
    .select('instagram_username, post_id, posted_at, is_tap_list, scraped_at')
    .order('posted_at', { ascending: false });

  if (error) throw error;

  // アカウント単位に集計
  const accounts = {};
  for (const post of data) {
    const u = post.instagram_username;
    if (!accounts[u]) {
      accounts[u] = {
        username: u,
        totalPosts: 0,
        tapListPosts: 0,
        lastScraped: null,
        lastTapList: null,
        lastPost: null,
      };
    }
    accounts[u].totalPosts++;
    if (post.is_tap_list) {
      accounts[u].tapListPosts++;
      if (!accounts[u].lastTapList || post.posted_at > accounts[u].lastTapList) {
        accounts[u].lastTapList = post.posted_at;
      }
    }
    if (!accounts[u].lastPost || post.posted_at > accounts[u].lastPost) {
      accounts[u].lastPost = post.posted_at;
    }
    if (!accounts[u].lastScraped || post.scraped_at > accounts[u].lastScraped) {
      accounts[u].lastScraped = post.scraped_at;
    }
  }

  const now = new Date();
  const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const alerts = [];
  const healthy = [];

  for (const acc of Object.values(accounts)) {
    const lastTapListDate = acc.lastTapList ? new Date(acc.lastTapList) : null;
    const lastPostDate = acc.lastPost ? new Date(acc.lastPost) : null;
    const daysSincePost = lastPostDate ? Math.floor((now - lastPostDate) / (24 * 60 * 60 * 1000)) : null;
    const daysSinceTapList = lastTapListDate ? Math.floor((now - lastTapListDate) / (24 * 60 * 60 * 1000)) : null;
    const tapListRate = acc.totalPosts > 0 ? Math.round(acc.tapListPosts / acc.totalPosts * 100) : 0;

    // 問題の切り分け
    let diagnosis = '';
    let severity = 'ok';

    if (!lastTapListDate && acc.totalPosts > 0) {
      // 一度もタップリスト未検出
      if (tapListRate === 0 && acc.totalPosts >= 3) {
        diagnosis = '⚠️  タップリスト投稿なし（Visionロジック or アカウント自体がタップリスト投稿していない可能性）';
        severity = 'warn';
      }
    } else if (lastTapListDate && lastTapListDate < oneMonthAgo) {
      // 1ヶ月以上前が最後のタップリスト
      if (daysSincePost < 7) {
        // 最近投稿はある → Vision抽出ミスかフォーマット変化
        diagnosis = '🔴 最近投稿あり、でもタップリスト未検出（Visionロジック or 投稿フォーマット変化の可能性）';
        severity = 'error';
      } else if (daysSincePost >= 30) {
        // 投稿自体が古い → 休止中？
        diagnosis = '😴 投稿が1ヶ月以上なし（休止中の可能性 → フォロー外し検討）';
        severity = 'warn';
      } else {
        diagnosis = '⚠️  タップリスト投稿が1ヶ月以上なし（投稿スタイル変化の可能性）';
        severity = 'warn';
      }
    }

    const entry = {
      username: acc.username,
      totalPosts: acc.totalPosts,
      tapListPosts: acc.tapListPosts,
      tapListRate: `${tapListRate}%`,
      lastPost: daysSincePost !== null ? `${daysSincePost}日前` : 'なし',
      lastTapList: daysSinceTapList !== null ? `${daysSinceTapList}日前` : 'なし',
      diagnosis,
      severity,
    };

    if (severity !== 'ok') {
      alerts.push(entry);
    } else {
      healthy.push(entry);
    }
  }

  return { alerts, healthy };
}

async function sendSlack(message) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
}

async function main() {
  const { alerts, healthy } = await alertReportDirect();

  let message = `*🍻 Now On Tap — 週次アラートレポート*\n${new Date().toLocaleDateString('ja-JP')}\n\n`;

  const totalBars = alerts.length + healthy.length;

  if (alerts.length === 0) {
    message += `✅ 全アカウント正常\nDB登録済み: *${totalBars}店舗*`;
  } else {
    message += `DB登録済み: *${totalBars}店舗* / うち要確認: *${alerts.length}件*\n\n`;
    message += `⚠️ *要確認アカウント*\n\n`;
    for (const a of alerts) {
      message += `*@${a.username}*\n`;
      message += `　投稿${a.totalPosts}件 / タップリスト${a.tapListPosts}件 (${a.tapListRate})\n`;
      message += `　最終投稿: ${a.lastPost} / 最終タップリスト: ${a.lastTapList}\n`;
      message += `　${a.diagnosis}\n`;
      message += `　<https://www.instagram.com/${a.username}/|Instagramを確認>\n\n`;
    }
    message += `✅ 正常: ${healthy.map(h => `@${h.username}`).join(', ')}`;
  }

  console.log(message);
  await sendSlack(message);
  console.log('\nSlack通知送信完了');
}

main().catch(console.error);
