// Instagramプロフィールから表示名（full_name）を取得してbars.nameを上書き
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SESSION_FILE = path.join(__dirname, '../data/session.json');

async function getProfileName(page, username) {
  await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  const fullName = await page.evaluate(() => {
    // プロフィール表示名は header > section > div の中のテキスト
    const selectors = [
      'header section h2',
      'header section h1',
      'header h1',
      'header h2',
      'span.x1lliihq[dir="auto"]',
      'h1.x1lliihq',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 0) return el.textContent.trim();
    }
    // フォールバック: ページタイトルから抽出 "店舗名 (@username) • Instagram"
    const title = document.title;
    const m = title.match(/^(.+?)\s*\(@/);
    if (m) return m[1].trim();
    return null;
  }).catch(() => null);

  return fullName;
}

async function run() {
  const { data: bars } = await supabase
    .from('bars')
    .select('id, instagram_username, name');

  // --allフラグがなければnameがnullのもの優先、あれば全件
  const fullScan = process.argv.includes('--all');
  const targets = fullScan ? bars : bars.filter(b => !b.name);

  console.log(`対象: ${targets.length}件 ${fullScan ? '(全件)' : '(name未設定のみ)'}\n`);
  if (targets.length === 0) { console.log('対象なし'); return; }

  const hasSession = fs.existsSync(SESSION_FILE);
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    ...(hasSession ? { storageState: SESSION_FILE } : {}),
  });
  const page = await context.newPage();

  // ログイン確認
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  if (page.url().includes('login') || !hasSession) {
    console.log('セッションなし or ログイン切れ。手動ログインしてください。');
    await browser.close();
    return;
  }

  let updated = 0, failed = 0, skipped = 0;

  for (const bar of targets) {
    process.stdout.write(`@${bar.instagram_username}... `);
    try {
      const fullName = await getProfileName(page, bar.instagram_username);
      if (!fullName || fullName === bar.name) {
        console.log(fullName ? '変更なし' : '取得失敗');
        skipped++;
        continue;
      }
      const { error } = await supabase.from('bars').update({ name: fullName }).eq('id', bar.id);
      if (error) throw error;
      console.log(`✅ "${fullName}"`);
      updated++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }
    await page.waitForTimeout(1000 + Math.random() * 1000);
  }

  await browser.close();
  console.log(`\n完了 — 更新: ${updated} / スキップ: ${skipped} / エラー: ${failed}`);
}

run().catch(console.error);
