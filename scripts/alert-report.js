// 週次アラートレポート: タップリスト異常 / 新規バー候補 / 新規ブルワリー / 未登録スタイル
const { execSync } = require('child_process');
const { DOMParser } = require('@xmldom/xmldom');
const fs = require('fs');
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

async function sendSlack(text) {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;

  // fallback: webhook
  if (!token || !channel) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) { console.log(text); return null; }
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return null;
  }

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel, text }),
  });
  const json = await res.json();
  return json.ts ?? null; // スレッド返信用タイムスタンプ
}

async function sendSlackThread(text, threadTs) {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token || !channel || !threadTs) return;
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel, text, thread_ts: threadTs }),
  });
}

const KML_URL = 'https://www.google.com/maps/d/kml?mid=1DaSgYBnJZnlWFmNFqvvHFqP6G_MxKGP4&forcekml=1';
const KML_PATH = '/tmp/breweries_alert.kml';

function fetchAndParseKml() {
  execSync(`curl -sL "${KML_URL}" -o "${KML_PATH}"`);
  const xml = fs.readFileSync(KML_PATH, 'utf8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const placemarks = doc.getElementsByTagName('Placemark');
  const results = [];
  for (let i = 0; i < placemarks.length; i++) {
    const p = placemarks[i];
    const name = p.getElementsByTagName('name')[0]?.textContent?.trim() ?? '';
    const desc = p.getElementsByTagName('description')[0]?.textContent ?? '';
    const fields = {};
    for (const part of desc.split('<br>')) {
      const idx = part.indexOf(': ');
      if (idx > 0) fields[part.slice(0, idx).trim()] = part.slice(idx + 2).trim();
    }
    const igUrl = fields['Instagram'] ?? '';
    const igMatch = igUrl.match(/instagram\.com\/([^/?"\s]+)/);
    const instagram = igMatch ? igMatch[1].replace(/\/$/, '') : null;
    const pref = fields['都道府県'] ?? null;
    if (pref === '東京' && instagram) {
      results.push({ name, instagram, type: fields['形態'] ?? null, nameEn: fields['Brewery'] ?? null });
    }
  }
  return results;
}

async function newBarCandidates() {
  const kmlBars = fetchAndParseKml();
  const { data: registered } = await supabase.from('bars').select('instagram_username');
  const registeredSet = new Set((registered ?? []).map(r => r.instagram_username.toLowerCase()));
  return kmlBars.filter(b => !registeredSet.has(b.instagram.toLowerCase()));
}

async function newMasterReport() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 直近1週間に追加されたブルワリー
  const { data: newBreweries } = await supabase
    .from('breweries')
    .select('name, name_ja, prefecture, country, created_at')
    .gte('created_at', oneWeekAgo)
    .order('created_at', { ascending: false });

  // beers.style でマスターにないスタイル
  const { data: beerStyles } = await supabase
    .from('beers')
    .select('style')
    .not('style', 'is', null);

  const { data: masterStyles } = await supabase
    .from('beer_styles')
    .select('name');

  const masterStyleNames = new Set((masterStyles ?? []).map(s => s.name));
  const styleCounts = {};
  for (const b of beerStyles ?? []) {
    if (b.style && !masterStyleNames.has(b.style)) {
      styleCounts[b.style] = (styleCounts[b.style] || 0) + 1;
    }
  }
  const unmappedStyles = Object.entries(styleCounts)
    .sort((a, b) => b[1] - a[1]);

  return { newBreweries: newBreweries ?? [], unmappedStyles };
}

async function runNormalization() {
  const { main: normalize } = require('./normalize-beers');
  return await normalize();
}

const ADMIN_URL = 'https://now-on-tap.pages.dev/admin';

async function main() {
  // 正規化バッチを先に実行
  const normResult = await runNormalization();

  const { alerts, healthy } = await alertReportDirect();
  const [{ newBreweries }, newBars] = await Promise.all([
    newMasterReport(),
    newBarCandidates(),
  ]);

  const totalBars = alerts.length + healthy.length;
  const date = new Date().toLocaleDateString('ja-JP');
  const autoBreweriesCount = normResult?.newBreweries?.added ?? 0;
  const unmatchedStylesCount = normResult?.newStyles?.added ?? 0;
  const totalIssues = alerts.length + newBars.length + autoBreweriesCount + unmatchedStylesCount;

  const msg = [
    `*🍻 Now On Tap 週次レポート* ${date}`,
    `店舗 *${totalBars}件* | TL要確認 *${alerts.length}件* | 新規バー候補 *${newBars.length}件* | ブルワリー自動追加 *${autoBreweriesCount}件* | スタイル未マッチ *${unmatchedStylesCount}件*`,
    totalIssues > 0 ? `\n要確認: *${totalIssues}件* → <${ADMIN_URL}|管理画面で確認>` : '\n✅ 要確認なし',
  ].join('\n');

  await sendSlack(msg);
  console.log('Slack通知送信完了');
}

main().catch(console.error);
